const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

let server;
let baseUrl;

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  await fetch(`${baseUrl}/api/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json();
  return { response, body };
}

test('exposes health, locations, and the routine catalog', async () => {
  const health = await request('/api/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.service, 'urban-air-quality-assistant');
  assert.equal(health.body.mode, 'local-mock');

  const locations = await request('/api/locations');
  assert.equal(locations.response.status, 200);
  assert.ok(locations.body.locations.length >= 5);
  assert.ok(locations.body.locations.some((item) => item.smogEpisode));

  const routines = await request('/api/routines');
  assert.equal(routines.response.status, 200);
  assert.ok(Array.isArray(routines.body.routines));
  assert.ok(routines.body.categories.includes('indoor_air'));
});

test('generates a household air-quality plan and serves it back', async () => {
  const create = await request('/api/plans', {
    method: 'POST',
    body: JSON.stringify({ sample: true }),
  });
  assert.equal(create.response.status, 201);
  assert.ok(create.body.plan.id.startsWith('AQ-'));
  assert.equal(create.body.plan.location.city, 'Delhi');
  assert.ok(create.body.plan.actions.length > 0);

  const list = await request('/api/plans');
  assert.equal(list.response.status, 200);
  assert.ok(list.body.total >= 1);

  const fetched = await request(`/api/plans/${create.body.plan.id}`);
  assert.equal(fetched.response.status, 200);
  assert.equal(fetched.body.plan.id, create.body.plan.id);
});

test('returns not found for an unknown plan', async () => {
  const missing = await request('/api/plans/AQ-999999');
  assert.equal(missing.response.status, 404);
});
