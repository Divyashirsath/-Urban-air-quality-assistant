/**
 * Deterministic air-quality assessment and exposure-impact math.
 *
 * The impact model is intentionally simple and inspectable: a household's
 * personal PM2.5 exposure is expressed as concentration x minutes per day, and
 * each recommended routine converts its before/after breathing-zone
 * concentrations into a saved-exposure delta. Health figures use a simplified
 * linear approximation of the WHO PM2.5 dose-response relationship and are
 * presented as estimates only.
 */

const POLLUTANT = 'PM2.5';

const LEVELS = ['good', 'moderate', 'unhealthy_for_sensitive', 'unhealthy', 'very_unhealthy', 'hazardous'];

const LEVEL_LABELS = {
  good: 'Good air',
  moderate: 'Moderate air',
  unhealthy_for_sensitive: 'Unhealthy for sensitive groups',
  unhealthy: 'Unhealthy',
  very_unhealthy: 'Very unhealthy',
  hazardous: 'Hazardous',
};

function airQualityLevel(aqi) {
  const value = Number(aqi) || 0;
  if (value <= 50) return 'good';
  if (value <= 100) return 'moderate';
  if (value <= 150) return 'unhealthy_for_sensitive';
  if (value <= 200) return 'unhealthy';
  if (value <= 300) return 'very_unhealthy';
  return 'hazardous';
}

function levelFromContext(context) {
  if (context && context.level) return context.level;
  return airQualityLevel((context && context.aqi) || 0);
}

function assessAirQuality(context, household = {}) {
  const level = levelFromContext(context);
  const aqi = Number((context && context.aqi) || 0);
  const pm25 = Number((context && context.pm25) || 0);
  const minutes = (household && household.minutes) || {};
  const flags = {
    aqi,
    level,
    label: LEVEL_LABELS[level] || LEVEL_LABELS.moderate,
    dominantPollutant: (context && context.dominantPollutant) || POLLUTANT,
    pm25,
    pm10: Number((context && context.pm10) || 0),
    season: (context && context.season) || 'winter',
    smogEpisode: Boolean((context && context.smogEpisode) || false),
    backgroundPm25: Number((context && context.backgroundPm25) || 0),
    householdSensitivity: Boolean(
      household.healthFlags && Object.values(household.healthFlags).some(Boolean),
    ),
    sensitiveGroups: household.healthFlags
      ? Object.keys(household.healthFlags).filter((key) => household.healthFlags[key])
      : [],
  };
  return flags;
}

function dailyExposureMinutes(context, household = {}) {
  const minutes = (household && household.minutes) || {};
  const minutesPerDay = Number(minutes.sleep || 480)
    + Number(minutes.exercise || 45)
    + Number(minutes.commute || 60)
    + Number(minutes.cooking || 30)
    + Number(minutes.leisure || 60)
    + Number(minutes.woodBurning || 60)
    + Number(minutes.laundry || 60);
  const pm25 = Number((context && context.pm25) || 0);
  return {
    pm25,
    minutesPerDay,
    exposure: pm25 * minutesPerDay,
    unit: 'µg/m³·min/day',
  };
}

function householdDailyExposure(context, household = {}) {
  const exposure = dailyExposureMinutes(context, household);
  return {
    ...exposure,
    estimatedLifeYearsAtBaseline: (exposure.exposure / 1440) * 0.05,
  };
}

/**
 * Simplified linear estimate of life-years gained from a sustained PM2.5
 * reduction. The WHO-style approximation anchors roughly 0.5 life-years lost
 * per 10 µg/m³ sustained PM2.5. The result is an estimate for planning support.
 */
function estimateLifeYearsGained(beforePm25, afterPm25, minutesPerDay) {
  const reduction = Number(beforePm25) - Number(afterPm25);
  const minutes = Number(minutesPerDay) || 0;
  const lifeYearsGained = reduction * (minutes / (24 * 60)) * 0.05;
  return Number(Math.max(0, lifeYearsGained).toFixed(2));
}

function actionImpact(action, context, household = {}) {
  const beforePm25 = Number(action.before(context, household) || 0);
  const afterPm25 = Number(action.after(context, household) || 0);
  const minutesPerDay = Number(action.minutes(context, household) || 0);
  const savedExposure = (beforePm25 - afterPm25) * minutesPerDay;
  const impact = {
    beforePm25,
    afterPm25,
    minutesPerDay,
    concentrationReduction: Number((beforePm25 - afterPm25).toFixed(2)),
    savedExposure: Number(savedExposure.toFixed(2)),
    lifeYearsGained: estimateLifeYearsGained(beforePm25, afterPm25, minutesPerDay),
  };
  if (typeof action.impactNarrative === 'function') {
    impact.explanation = action.impactNarrative({ context, household, impact });
  } else {
    impact.explanation = `${action.title}: breathing-zone PM2.5 changes from ${beforePm25} to ${afterPm25} µg/m³ over ${minutesPerDay} minutes per day; approximately ${savedExposure} µg/m³·min of personal exposure is avoided.`;
  }
  return impact;
}

module.exports = {
  LEVELS,
  LEVEL_LABELS,
  actionImpact,
  airQualityLevel,
  assessAirQuality,
  dailyExposureMinutes,
  estimateLifeYearsGained,
  householdDailyExposure,
};
