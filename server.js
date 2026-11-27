const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { DemoStore } = require('./src/store');
const { adapterStatus, listLocations } = require('./src/airquality');
const { ACTION_CATALOG, SAMPLE_INPUT } = require('./src/agent');
const { runAirQualityPlan } = require('./src/agent');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const store = new DemoStore();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function text(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Request body must be valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function createPlanFromRequest(body = {}) {
  if (body.sample) return { location: SAMPLE_INPUT.location, household: SAMPLE_INPUT.household };
  return { location: body.location, household: body.household || body.profile };
}

async function handleApi(req, res, url) {
  const { pathname, searchParams } = url;
  const method = req.method || 'GET';
  const parts = pathname.split('/').filter(Boolean);

  if (method === 'GET' && pathname === '/api/health') {
    return json(res, 200, { ok: true, service: 'urban-air-quality-assistant', mode: 'local-mock', time: new Date().toISOString() });
  }
  if (method === 'GET' && pathname === '/api/config') {
    return json(res, 200, { airQuality: adapterStatus() });
  }
  if (method === 'GET' && pathname === '/api/locations') {
    return json(res, 200, { locations: listLocations() });
  }
  if (method === 'GET' && pathname === '/api/routines') {
    const categories = [...new Set(ACTION_CATALOG.map((item) => item.category))].sort();
    const routines = ACTION_CATALOG.map((item) => ({
      id: item.id,
      type: item.type,
      category: item.category,
      title: item.title,
      description: item.description,
      alternative: item.alternative,
      priority: item.priority,
      steps: item.steps,
    }));
    return json(res, 200, { routines, categories });
  }
  if (method === 'POST' && pathname === '/api/plans') {
    const body = await readBody(req);
    const input = createPlanFromRequest(body);
    const plan = await runAirQualityPlan(input);
    store.addPlan(plan);
    store.audit({ actor: 'Assistant agent', event: 'Air plan generated', detail: `${plan.id} for ${plan.location?.city || 'household'}.` });
    return json(res, 201, { plan });
  }
  if (method === 'GET' && pathname === '/api/plans') {
    const plans = store.listPlans();
    return json(res, 200, { plans, total: plans.length });
  }
  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'plans' && parts[2]) {
    const plan = store.getPlan(parts[2]);
    return plan ? json(res, 200, { plan }) : json(res, 404, { error: 'Plan not found' });
  }
  if (method === 'POST' && pathname === '/api/reset') {
    store.reset();
    return json(res, 200, { ok: true, message: 'Demo state reset.' });
  }
  return json(res, 404, { error: 'API route not found' });
}

function serveStatic(req, res, url) {
  let requestedPath = decodeURIComponent(url.pathname);
  if (requestedPath === '/') requestedPath = '/index.html';
  const normalized = path.normalize(requestedPath).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, normalized);
  if (!filePath.startsWith(PUBLIC_DIR)) return text(res, 403, 'Forbidden');
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) return text(res, 404, 'Not found');
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      return res.end();
    }
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      return serveStatic(req, res, url);
    } catch (error) {
      console.error(error);
      return json(res, 500, { error: error.message || 'Internal server error' });
    }
  });
}

if (require.main === module) {
  createServer().listen(PORT, HOST, () => {
    console.log(`Urban Air Quality Assistant running at http://${HOST}:${PORT}`);
    console.log('Mode: local-mock (no external API keys required)');
  });
}

module.exports = {
  createServer,
};
