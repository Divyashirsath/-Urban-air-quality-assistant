/**
 * Assistant narrative seam.
 *
 * The deterministic planner produces structured, measurable action plans. This
 * module turns a plan into human-readable guidance. In local-mock mode it uses
 * a templated narrative built from the plan facts; when an LLM API key is
 * configured it can call an OpenAI-compatible chat completions endpoint with
 * only the retrieved air-quality context and the proposed actions.
 */

const mode = process.env.LLM_API_KEY ? 'live' : 'local-mock';

const POLLUTANT_LABELS = {
  'PM2.5': 'particulate matter (PM2.5)',
};

function pollutantLabel(pollutant) {
  const key = String(pollutant || 'PM2.5');
  return POLLUTANT_LABELS[key] || key;
}

function describeAir(context) {
  const level = context.level || 'moderate';
  const label = level === 'hazardous'
    ? 'hazardous air quality'
    : level === 'very_unhealthy'
      ? 'very unhealthy air quality'
      : level === 'unhealthy'
        ? 'unhealthy air quality'
        : level === 'unhealthy_for_sensitive'
          ? 'unhealthy air quality for sensitive groups'
          : level === 'moderate'
            ? 'moderate air quality'
            : 'good air quality';
  const seasonNote = context.smogEpisode || context.season === 'winter'
    ? 'This is a severe winter-smog episode profile, so indoor air protection matters most.'
    : 'Air quality is acceptable, but the assistant still recommends low-emission routines.';
  return `${context.city || 'This location'} is reporting ${context.pm25 ?? 0} µg/m³ of ${pollutantLabel(context.dominantPollutant || 'PM2.5')}, which is ${label}. ${seasonNote}`;
}

function localPlanNarrative(plan) {
  const context = plan.location || {};
  const actions = plan.actions || [];
  const top = actions.slice(0, 3);
  const household = plan.household || {};
  const projected = plan.projectedImpact || {};
  const lifeYears = Number((projected && projected.lifeYearsGained) || 0);
  const actionText = top.length
    ? top.map((item) => `${item.title} (estimated ${item.impact.savedExposure} µg/m³·min/day saved)`).join('; ')
    : 'No high-impact routines were triggered for this profile.';
  return [
    describeAir(context),
    `Based on the ${household.healthFlags ? Object.keys(household.healthFlags).filter((key) => household.healthFlags[key]).length : 0} reported sensitive group(s) in the household, the assistant prioritized ${actions.length} low-emission routine(s).`,
    `The top recommended actions are ${actionText}.`,
    lifeYears > 0
      ? `Combined, the proposed routines could remove an estimated ${projected.savedDailyExposure} µg/m³·min/day of personal PM2.5 exposure and are associated with an estimated ${lifeYears} life-years gained (approximate).`
      : 'Combined, the proposed routines could remove personal PM2.5 exposure in the low-emission range.',
    'Indoor air quality hacks are listed first because they reduce exposure fastest during severe smog; sustainable travel and lifestyle swaps follow.',
  ].join(' ');
}

async function generatePlanNarrative(plan) {
  if (mode === 'live') {
    const apiKey = process.env.LLM_API_KEY;
    const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'You are the Urban Air Quality Assistant. You help families choose low-emission routines and explain the direct impact of each choice. Answer concisely and never invent measurements.',
          },
          {
            role: 'user',
            content: JSON.stringify({ plan }),
          },
        ],
      }),
    });
    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content;
    if (!response.ok || !text) throw new Error('LLM narrative provider unavailable');
    return String(text);
  }
  return localPlanNarrative(plan);
}

async function generateImpactExplanation(action) {
  const impact = action.impact || {};
  const before = Number(impact.beforePm25 || 0);
  const after = Number(impact.afterPm25 || 0);
  const saved = Number(impact.savedExposure || 0);
  const lifeYears = Number(impact.lifeYearsGained || 0);
  const text = [
    `${action.title}: breathing-zone PM2.5 ${before} → ${after} µg/m³.`,
    `The routine avoids about ${saved} µg/m³·min of personal exposure per day.`,
    lifeYears > 0 ? `Estimated simplified-model life-years gained: ${lifeYears}.` : 'Estimated simplified-model life-years gained: 0.',
  ].join(' ');
  if (mode === 'live') {
    // Reserved for a live per-action narrative call with the retrieved context.
    return text;
  }
  return text;
}

module.exports = {
  mode,
  generateImpactExplanation,
  generatePlanNarrative,
};
