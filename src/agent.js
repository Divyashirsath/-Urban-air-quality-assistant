/**
 * Urban Air Quality Assistant agent workflow.
 *
 * The agent turns a household air-safety profile plus a location into a
 * prioritized, measurable low-emission action plan:
 *
 *   1. retrieveAirContext  - adapter seam for location air-quality data
 *   2. assessAirQuality    - PM2.5 / AQI assessment for the household
 *   3. buildRoutinePlan     - filter the routine catalog against the profile
 *   4. scoreRoutineImpact  - deterministic before/after exposure math
 *   5. prioritize           - indoor-first ordering for severe smog episodes
 *   6. narrate              - LLM seam for human-readable guidance
 */

const { retrieveAirContext } = require('./airquality');
const {
  actionImpact,
  assessAirQuality,
  householdDailyExposure,
} = require('./impact');
const { generatePlanNarrative, mode } = require('./llm');

const round2 = (value) => Number(Number(value || 0).toFixed(2));

function defaultHousehold() {
  return {
    healthFlags: {
      asthma: false,
      copd: false,
      heartDisease: false,
      pregnancy: false,
      children: false,
    },
    activities: {
      schoolCommute: false,
      workCommute: false,
      exercise: false,
      outdoorLeisure: false,
      cooking: false,
      woodBurning: false,
      candlesIncense: false,
      laundry: false,
    },
    minutes: {
      sleep: 480,
      exercise: 45,
      commute: 60,
      cooking: 30,
      leisure: 60,
      woodBurning: 60,
      laundry: 60,
    },
  };
}

function normalizeHousehold(household) {
  const base = defaultHousehold();
  const source = household || {};
  const healthFlags = { ...base.healthFlags, ...(source.healthFlags || {}) };
  const activities = { ...base.activities, ...(source.activities || {}) };
  const minutes = { ...base.minutes, ...(source.minutes || {}) };
  return { healthFlags, activities, minutes };
}

function badAir(context) {
  const level = context.level || 'moderate';
  return ['unhealthy_for_sensitive', 'unhealthy', 'very_unhealthy', 'hazardous'].includes(level);
}

const ACTION_CATALOG = [
  {
    id: 'indoor_hepa_sleep',
    type: 'indoor_air',
    category: 'indoor_air',
    bucket: 'sleep',
    priority: 1,
    title: 'Run a HEPA air purifier in the sleeping area',
    description: 'A HEPA purifier in the bedroom removes PM2.5 while the household sleeps through the night.',
    steps: [
      'Run a HEPA purifier (99% or higher PM2.5 efficiency) in the bedroom during sleep.',
      'Close the bedroom door to create a filtered micro-zone.',
      'Keep the purifier off the carpet and away from heat sources.',
    ],
    alternative: 'Use a certified portable air cleaner; if none is available, relocate sleep to a room with an HVAC HEPA filter.',
    applies: (context, household) => Boolean(context.pm25) && (badAir(context) || Boolean(household.activities.exercise)),
    before: (context, household) => context.pm25,
    after: (context, household) => round2(context.pm25 * 0.08),
    minutes: (context, household) => Number((household.minutes || {}).sleep || 480),
  },
  {
    id: 'indoor_seal_crack',
    type: 'indoor_air',
    category: 'indoor_air',
    bucket: 'sleep',
    priority: 2,
    title: 'Seal windows and doors, and ventilate at low-emission times',
    description: 'Seal window gaps during winter smog and use cross-ventilation when cooking or heating.',
    steps: [
      'Apply weatherstripping or draft seals around windows and doors.',
      'Ventilate briefly with outdoor air when pollutant levels are lower.',
      'Use exhaust fans with outdoor exhaust during cooking.',
    ],
    alternative: 'Use a window filter kit or door sweep; keep natural ventilation as a fallback.',
    applies: (context) => context.season === 'winter' || badAir(context),
    before: (context) => context.pm25,
    after: (context) => round2(context.pm25 * 0.7),
    minutes: (context, household) => Number((household.minutes || {}).sleep || 480),
  },
  {
    id: 'exercise_indoor_shift',
    type: 'movement',
    category: 'low_emission_routine',
    bucket: 'exercise',
    priority: 3,
    title: 'Move outdoor exercise indoors or onto low-traffic routes',
    description: 'Shift aerobic activity into a filtered room or a low-traffic green route.',
    steps: [
      'Choose an indoor space with a HEPA purifier or good ventilation.',
      'If outdoors, pick low-traffic routes and avoid rush-hour traffic corridors.',
      'Reduce intensity when the AQI is unhealthy for sensitive groups.',
    ],
    alternative: 'Use a treadmill, stationary bike, or bodyweight routine indoors.',
    applies: (context, household) => Boolean(household.activities.exercise),
    before: (context) => round2(context.pm25 * 1.25),
    after: (context) => round2(context.pm25 * 0.8),
    minutes: (context, household) => Number((household.minutes || {}).exercise || 45),
  },
  {
    id: 'commute_shift_active',
    type: 'movement',
    category: 'low_emission_routine',
    bucket: 'commute',
    priority: 4,
    title: 'Shift commuting to walking, transit, or carpool off-peak',
    description: 'Replace single-occupancy car trips during smog episodes with shared or active travel.',
    steps: [
      'Combine school/work trips into one bus/walk/car pool route.',
      'Travel outside peak morning and evening traffic windows.',
      'Keep vehicle idling off; use park-and-ride near transit.',
    ],
    alternative: 'Remote work, staggered shifts, or neighborhood carpooling.',
    applies: (context, household) => Boolean(household.activities.schoolCommute || household.activities.workCommute),
    before: (context) => round2(context.pm25 * 1.2),
    after: (context) => round2(context.pm25 * 0.4),
    minutes: () => 60,
  },
  {
    id: 'cooking_ventilation',
    type: 'home_hack',
    category: 'indoor_air',
    bucket: 'cooking',
    priority: 5,
    title: 'Ventilate while cooking and avoid high-emission cooking methods',
    description: 'Cooking fumes add to urban PM2.5; use ventilation and lower-emission methods.',
    steps: [
      'Run the exhaust fan and open a window during cooking.',
      'Avoid high-heat frying and char grilling; use gentler cooking methods.',
      'Clean kitchen exhaust filters regularly.',
    ],
    alternative: 'Batch cooking and outdoor grilling only when air quality is good.',
    applies: (context, household) => Boolean(household.activities.cooking),
    before: (context) => round2(context.pm25 * 1.5),
    after: (context) => round2(context.pm25 * 0.2),
    minutes: (context, household) => Number((household.minutes || {}).cooking || 30),
  },
  {
    id: 'wood_smoke_reduction',
    type: 'home_hack',
    category: 'indoor_air',
    bucket: 'woodBurning',
    priority: 6,
    title: 'Avoid wood burning and switch to cleaner heating alternatives',
    description: 'Wood burning is a major winter PM2.5 source; pause or replace it during severe smog.',
    steps: [
      'Pause fireplace and wood-burning stove use during smog episodes.',
      'Use cleaner heating (heat pump, gas, or non-burning warmth) if available.',
      'If burning is unavoidable, use the cleanest fuel and short, low-temperature burns.',
    ],
    alternative: 'Electric heating, gas, or layered warm clothing.',
    applies: (context, household) => Boolean(household.activities.woodBurning),
    before: () => 420,
    after: () => 0,
    minutes: (context, household) => Number((household.minutes || {}).woodBurning || 60),
  },
  {
    id: 'laundry_dust_control',
    type: 'lifestyle',
    category: 'lifestyle',
    bucket: 'laundry',
    priority: 7,
    title: 'Launder and ventilate with dust-reduction habits',
    description: 'Damp dusting and vented laundering reduce resuspended urban dust and PM2.5.',
    steps: [
      'Use damp or vacuum-with-particulate-filter dusting.',
      'Launder in cold water and clean filters; air-dry or use vented dryer.',
    ],
    alternative: 'Reduce dry dusting; use HEPA vacuum.',
    applies: (context, household) => Boolean(household.activities.laundry),
    before: (context) => round2(context.pm25 * 0.8),
    after: (context) => round2(context.pm25 * 0.25),
    minutes: () => 60,
  },
  {
    id: 'candles_incense_avoid',
    type: 'lifestyle',
    category: 'lifestyle',
    bucket: 'candlesIncense',
    priority: 8,
    title: 'Avoid candles and incense during high-pollution episodes',
    description: 'Smoke from candles and incense adds fine particles to indoor air.',
    steps: [
      'Skip candles and incense during severe smog or when indoors with children.',
      'Use a vented electric diffuser or skip scent entirely.',
    ],
    alternative: 'Unscented room sprays or no fragrance.',
    applies: (context, household) => Boolean(household.activities.candlesIncense),
    before: () => 55,
    after: () => 0,
    minutes: () => 10,
  },
];

const SAMPLE_INPUT = {
  location: { id: 'delhi', city: 'Delhi', region: 'Delhi NCR', country: 'India' },
  household: {
    healthFlags: { asthma: true, copd: false, heartDisease: false, pregnancy: false, children: true },
    activities: {
      schoolCommute: true,
      workCommute: true,
      exercise: true,
      outdoorLeisure: true,
      cooking: true,
      woodBurning: true,
      candlesIncense: false,
      laundry: true,
    },
    minutes: { sleep: 480, exercise: 60, commute: 90, cooking: 45, leisure: 60, woodBurning: 60, laundry: 60 },
  },
};

async function runAirQualityPlan(input = {}) {
  const household = normalizeHousehold(input.household);
  const context = retrieveAirContext(input.location);
  const air = assessAirQuality(context, household);

  const candidates = ACTION_CATALOG
    .filter((action) => action.applies(context, household))
    .map((action) => ({ action, impact: actionImpact(action, context, household) }));

  const actions = candidates
    .map(({ action, impact }) => ({
      id: action.id,
      type: action.type,
      category: action.category,
      bucket: action.bucket,
      priority: action.priority,
      title: action.title,
      description: action.description,
      steps: action.steps,
      alternative: action.alternative,
      applies: true,
      before: impact.beforePm25,
      after: impact.afterPm25,
      minutesPerDay: impact.minutesPerDay,
      impact,
    }))
    .sort((a, b) => a.priority - b.priority || b.impact.savedExposure - a.impact.savedExposure);

  const topPriorityActions = actions.slice(0, 3);

  // Projected household exposure: apply one routine per exposure bucket so
  // complementary indoor hacks are not counted twice against the same minutes.
  const bestByBucket = new Map();
  for (const item of actions) {
    const existing = bestByBucket.get(item.bucket);
    if (!existing || item.after < existing.after) bestByBucket.set(item.bucket, item);
  }
  const projectedActions = [...bestByBucket.values()];
  const savedDailyExposure = round2(projectedActions.reduce((sum, item) => sum + Number(item.impact.savedExposure || 0), 0));
  const lifeYearsGained = round2(projectedActions.reduce((sum, item) => sum + Number(item.impact.lifeYearsGained || 0), 0));

  const baseline = householdDailyExposure(context, household);
  const plan = {
    id: `AQ-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString(),
    mode,
    source: 'local-mock',
    location: context,
    air: air,
    household,
    actions,
    topPriorityActions,
    projectedImpact: {
      savedDailyExposure,
      lifeYearsGained,
      baselineExposure: round2(baseline.exposure),
      actionsApplied: projectedActions.length,
      unit: 'µg/m³·min/day',
    },
    summary: `Air quality in ${context.city} is ${air.label.toLowerCase()} with PM2.5 at ${context.pm25} µg/m³. The assistant identified ${actions.length} low-emission routine(s) matched to this household, prioritizing indoor air protection before outdoor and lifestyle adjustments.`,
  };

  plan.narrative = await generatePlanNarrative(plan);
  return plan;
}

module.exports = {
  ACTION_CATALOG,
  SAMPLE_INPUT,
  defaultHousehold,
  normalizeHousehold,
  runAirQualityPlan,
};
