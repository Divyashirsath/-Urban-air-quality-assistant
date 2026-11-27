const state = {
  route: 'plan',
  plan: null,
  locations: [],
  routines: [],
  busy: false,
};

const $ = (id) => document.getElementById(id);

function showToast(message, type = 'info') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`.trim();
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('leaving'), 0);
  setTimeout(() => toast.remove(), 3200);
}

function showRoute(route) {
  state.route = route;
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.route === route));
  document.querySelectorAll('.view').forEach((view) => {
    view.hidden = view.dataset.view !== route;
  });
  $('topbar-page').textContent = route === 'plan' ? 'Action plan' : 'Routine library';
}

function setBusy(isBusy) {
  state.busy = isBusy;
  $('generate-plan-button').disabled = isBusy;
  document.querySelectorAll('#household-form .primary-button, #household-form .ghost-button').forEach((item) => {
    item.disabled = isBusy;
  });
}

async function loadLocations() {
  const response = await fetch('/api/locations');
  const body = await response.json();
  state.locations = body.locations || [];
  const select = $('location-select');
  state.locations.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.city}${item.region ? ` · ${item.region}` : ''} — PM2.5 ${item.pm25} µg/m³`;
    select.appendChild(option);
  });
}

async function loadRoutines() {
  const response = await fetch('/api/routines');
  const body = await response.json();
  state.routines = body.routines || [];
  const grid = $('routine-grid');
  grid.innerHTML = '';
  if (!state.routines.length) {
    grid.innerHTML = '<div class="empty-state">No routines available yet.</div>';
    return;
  }
  state.routines.forEach((routine) => {
    const card = document.createElement('div');
    card.className = 'routine-card';
    card.innerHTML = `
      <div class="action-cat"><span class="badge">${routine.category.replace(/_/g, ' ')}</span></div>
      <h3>${routine.title}</h3>
      <p class="muted">${routine.description}</p>
      <ol class="action-steps compact">
        ${routine.steps.map((step) => `<li>${step}</li>`).join('')}
      </ol>
      ${routine.alternative ? `<p class="action-alt">Alternative: ${routine.alternative}</p>` : ''}
    `;
    grid.appendChild(card);
  });
}

function collectHousehold() {
  const read = (prefix, defaults) => {
    const values = { ...defaults };
    document.querySelectorAll(`[data-${prefix}]`).forEach((input) => {
      values[input.dataset[prefix]] = input.checked;
    });
    return values;
  };
  const readNumber = (id, fallback) => {
    const value = Number($('household-size').value);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    householdSize: readNumber('household-size', 4),
    healthFlags: read('health', { asthma: false, copd: false, heartDisease: false, pregnancy: false, children: false }),
    activities: read('activity', {
      schoolCommute: false,
      workCommute: false,
      exercise: false,
      outdoorLeisure: false,
      cooking: false,
      woodBurning: false,
      candlesIncense: false,
      laundry: false,
    }),
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

async function generatePlan() {
  setBusy(true);
  try {
    const household = collectHousehold();
    const selected = $('location-select').value;
    const location = state.locations.find((item) => item.id === selected) || { id: selected || 'local-region', city: selected || 'Local region', region: '', country: '' };
    const response = await fetch('/api/plans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ location, household }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Failed to generate the action plan.');
    state.plan = body.plan;
    const intro = document.querySelector('.intro-panel');
    if (state.plan) intro.hidden = true;
    renderPlan(state.plan);
    showToast('Action plan generated for your household.');
  } catch (error) {
    showToast(error.message || 'Failed to generate the action plan.', 'error');
  } finally {
    setBusy(false);
  }
}

function levelBadgeClass(level) {
  return `badge ${level || 'moderate'}`.trim();
}

function renderPlan(plan) {
  const container = $('plan-output');
  container.innerHTML = `
    <div class="air-hero">
      <div class="panel">
        <div class="action-head">
          <div>
            <h2>Air quality briefing</h2>
            <p class="muted">${plan.location?.city || 'Unknown location'}${plan.location?.region ? ` · ${plan.location.region}` : ''}${plan.location?.country ? ` · ${plan.location.country}` : ''}</p>
          </div>
          <span class="${levelBadgeClass(plan.air?.level)}">${plan.air?.label || 'Moderate air'}</span>
        </div>
        <div class="air-score">
          <div>
            <div class="value">${plan.location?.pm25 ?? 0}</div>
            <div class="unit">µg/m³ PM2.5 · AQI ${plan.air?.aqi ?? '—'}</div>
          </div>
          <div>
            <div class="value">${plan.location?.pm10 ?? '—'}</div>
            <div class="unit">µg/m³ PM10</div>
          </div>
          <div>
            <div class="value">${plan.air?.season || 'winter'}</div>
            <div class="unit">season</div>
          </div>
        </div>
        <div class="metric-row">
          <div class="metric"><strong>${plan.air?.backgroundPm25 ?? '—'}</strong><span>background PM2.5</span></div>
          <div class="metric"><strong>${plan.air?.smogEpisode ? 'Yes' : 'No'}</strong><span>smog episode</span></div>
          <div class="metric"><strong>${plan.air?.householdSensitivity ? 'Yes' : 'No'}</strong><span>household sensitivity</span></div>
        </div>
        <p class="muted" style="margin-bottom: 0;">Dominant pollutant: ${plan.air?.dominantPollutant || 'PM2.5'}. Sensitive groups reported: ${(plan.air?.sensitiveGroups || []).join(', ') || 'none'}.</p>
      </div>
      <div class="panel">
        <h2>Projected household impact</h2>
        <div class="projected">
          <strong>${plan.projectedImpact?.savedDailyExposure ?? 0} µg/m³·min/day</strong>
          <span>estimated daily exposure avoided</span>
          <div class="projected" style="margin-top: 8px;">
            <strong>${plan.projectedImpact?.lifeYearsGained ?? 0}</strong>
            <span>estimated life-years gained (approx.)</span>
          </div>
        </div>
        <p class="muted" style="margin-bottom: 0;">Baseline personal exposure ≈ ${plan.projectedImpact?.baselineExposure ?? 0} µg/m³·min/day across sleep, movement, cooking, and chores.</p>
      </div>
    </div>

    <div class="panel narrative-card" style="margin-bottom: 18px;">
      <h2>Assistant guidance</h2>
      <p>${plan.narrative || 'The assistant is preparing guidance…'}</p>
    </div>

    <h2>Prioritized routines</h2>
    <div class="action-list" id="action-list"></div>

    <div class="disclaimer">
      Impact figures are deterministic estimates for planning support, not medical advice. Air-quality values come from the local demo adapter; confirm with official monitoring and consult healthcare providers for sensitive family members.
    </div>
  `;

  const list = $('action-list');
  list.innerHTML = '';
  (plan.actions || []).forEach((item) => {
    const top = (plan.topPriorityActions || []).some((topItem) => topItem.id === item.id);
    const card = document.createElement('div');
    card.className = `action-card ${top ? 'top' : ''}`;
    card.innerHTML = `
      <div class="action-head">
        <h3>${item.title}</h3>
        <span class="action-cat"><span class="badge">${item.category.replace(/_/g, ' ')}</span></span>
      </div>
      <p class="action-desc">${item.description}</p>
      <div class="action-impact">
        <div class="impact-cell"><strong>${item.before} → ${item.after}</strong><span>PM2.5 before → after (µg/m³)</span></div>
        <div class="impact-cell"><strong>${item.impact?.savedExposure ?? 0}</strong><span>exposure avoided (µg/m³·min/day)</span></div>
        <div class="impact-cell"><strong>${item.impact?.lifeYearsGained ?? 0}</strong><span>life-years gained (approx.)</span></div>
        <div class="impact-cell"><strong>${item.minutesPerDay ?? 0}</strong><span>minutes affected / day</span></div>
      </div>
      <ol class="action-steps">
        ${(item.steps || []).map((step) => `<li>${step}</li>`).join('')}
      </ol>
      ${item.alternative ? `<p class="action-alt">Sustainable alternative: ${item.alternative}</p>` : ''}
      ${item.impact?.explanation ? `<div class="action-impact-note">${item.impact.explanation}</div>` : ''}
      ${top ? '<div style="margin-top:10px;"><span class="badge good">Top priority for this household</span></div>' : ''}
    `;
    list.appendChild(card);
  });

  if (!plan.actions || !plan.actions.length) {
    list.innerHTML = '<div class="empty-state">No routines matched this profile. Adjust the household details or location.</div>';
  }
}

async function init() {
  document.querySelector('[data-action="reset-demo"]').addEventListener('click', async () => {
    await fetch('/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    state.plan = null;
    const intro = document.querySelector('.intro-panel');
    if (intro) intro.hidden = false;
    $('plan-output').innerHTML = '';
    showToast('Demo state reset.');
  });

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => showRoute(item.dataset.route));
  });
  $('mobile-menu').addEventListener('click', () => document.querySelector('.sidebar').classList.remove('open'));
  $('generate-plan-button').addEventListener('click', generatePlan);
  $('use-sample-button').addEventListener('click', async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sample: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Failed to generate the sample plan.');
      state.plan = body.plan;
      const intro = document.querySelector('.intro-panel');
      if (intro) intro.hidden = true;
      renderPlan(state.plan);
      showToast('Sample action plan generated.');
    } catch (error) {
      showToast(error.message || 'Failed to generate the sample plan.', 'error');
    } finally {
      setBusy(false);
    }
  });

  await Promise.all([loadLocations(), loadRoutines()]);
  showRoute('plan');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
