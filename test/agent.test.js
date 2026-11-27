const test = require('node:test');
const assert = require('node:assert/strict');
const { runAirQualityPlan, SAMPLE_INPUT } = require('../src/agent');

test('retrieves a severe winter smog profile and builds a prioritized plan', async () => {
  const plan = await runAirQualityPlan({
    location: { id: 'delhi' },
    household: SAMPLE_INPUT.household,
  });

  assert.equal(plan.mode, 'local-mock');
  assert.equal(plan.location.city, 'Delhi');
  assert.equal(plan.location.pm25 > 50, true);
  assert.equal(plan.air.level, 'unhealthy_for_sensitive');
  assert.equal(plan.air.season, 'winter');
  assert.equal(plan.air.smogEpisode, true);
  assert.ok(Array.isArray(plan.actions) && plan.actions.length > 0);
  assert.ok(plan.actions.every((item) => item.impact && item.impact.savedExposure >= 0));
});

test('prioritizes indoor air protection before outdoor routines during severe smog', async () => {
  const plan = await runAirQualityPlan({
    location: { id: 'lahore' },
    household: {
      healthFlags: { asthma: false, copd: false, heartDisease: false, pregnancy: false, children: false },
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
      minutes: { sleep: 480, exercise: 45, commute: 60, cooking: 30, leisure: 60, woodBurning: 60, laundry: 60 },
    },
  });

  assert.equal(plan.air.level, 'very_unhealthy');
  assert.equal(plan.actions[0].id, 'indoor_hepa_sleep');
  assert.equal(plan.actions[0].priority, 1);
});

test('tailors low-emission routines to household activities', async () => {
  const plan = await runAirQualityPlan({
    location: { id: 'delhi' },
    household: {
      ...SAMPLE_INPUT.household,
      activities: { ...SAMPLE_INPUT.household.activities, exercise: true, schoolCommute: false, workCommute: false },
    },
  });

  const actionIds = plan.actions.map((item) => item.id);
  assert.ok(actionIds.includes('exercise_indoor_shift'));
  assert.ok(actionIds.includes('indoor_hepa_sleep'));
});

test('explains the direct impact of each routine with before-after exposure math', async () => {
  const plan = await runAirQualityPlan(SAMPLE_INPUT);
  const hepa = plan.actions.find((item) => item.id === 'indoor_hepa_sleep');

  assert.ok(hepa);
  assert.ok(hepa.impact.beforePm25 > hepa.impact.afterPm25);
  assert.ok(hepa.impact.savedExposure > 0);
  assert.ok(hepa.impact.lifeYearsGained > 0);
  assert.ok(hepa.impact.explanation.length > 0);
});

test('projects combined household exposure savings', async () => {
  const plan = await runAirQualityPlan(SAMPLE_INPUT);
  const projected = plan.projectedImpact || {};
  assert.ok(Number(projected.savedDailyExposure) > 0);
  assert.ok(Number(projected.lifeYearsGained) >= 0);
  assert.ok(Number(projected.actionsApplied) > 0);
});
