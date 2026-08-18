const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../../server');
const { closeDatabase } = require('../../src/database');

let server;
const PORT = 3012;
let dispatchToken;

test.before(async () => {
  server = app.listen(PORT);
  await new Promise((resolve) => server.once('listening', resolve));

  const loginResponse = await fetch(`http://127.0.0.1:${PORT}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'dispatcher', password: 'goldenhour@123' })
  });

  const loginData = await loginResponse.json();
  dispatchToken = loginData.token;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await closeDatabase();
});

async function callRoute(method, path, body = null, token = dispatchToken) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const response = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  return response;
}

test('GET /api/health returns 200 ok', async () => {
  const res = await callRoute('GET', '/api/health', null, null);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.status, 'ok');
});

test('GET /api/ready returns 200 ready', async () => {
  const res = await callRoute('GET', '/api/ready', null, null);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ready, true);
});

test('GET /api/verify-token verifies authenticated user', async () => {
  const res = await callRoute('GET', '/api/verify-token');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.user.role, 'dispatcher');
});

test('GET /api/dashboard returns complete operational summary', async () => {
  const res = await callRoute('GET', '/api/dashboard');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.data.summary);
  assert.ok(data.data.map);
  assert.ok(data.data.kpis);
});

test('POST /api/incidents creates incident and logs audit', async () => {
  const res = await callRoute('POST', '/api/incidents', {
    title: 'Integration Test Incident',
    location: 'Central Junction',
    latitude: 26.9124,
    longitude: 75.7873,
    severity: 'critical',
    patient_count: 3
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.incident.id);
});

test('POST /api/dispatch executes automated dispatch decision', async () => {
  const res = await callRoute('POST', '/api/dispatch', { incidentId: 'INC-1001' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.ambulanceNumber || data.data.decision);
});

test('PATCH /api/hospitals/:id updates bed availability', async () => {
  const res = await callRoute('PATCH', '/api/hospitals/HSP-201', { available_beds: 45 });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
});

test('GET /api/audit-logs returns list of system events', async () => {
  const res = await callRoute('GET', '/api/audit-logs');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.data));
  assert.ok(data.data.length >= 1);
});

test('GET /api/metrics returns system performance SLAs', async () => {
  const res = await callRoute('GET', '/api/metrics');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.systemHealth, 'OPERATIONAL');
});
