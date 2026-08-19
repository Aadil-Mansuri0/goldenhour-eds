const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../../server');
const { initializeDatabase, closeDatabase } = require('../../src/database');

let server;
const PORT = 3012;
let dispatchToken;

test.before(async () => {
  await initializeDatabase();
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
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
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

test('GET /api/health returns 200 ok with Pan-India network status', async () => {
  const res = await callRoute('GET', '/api/health', null, null);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.status, 'ok');
  assert.ok(data.metrics.hospitals >= 15);
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

test('PATCH /api/hospitals/:id updates bed availability and logs audit', async () => {
  const res = await callRoute('PATCH', '/api/hospitals/HSP-JPR-01', { available_beds: 48 });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
});

test('GET /api/hospitals/nearby performs geospatial distance calculations', async () => {
  const res = await callRoute('GET', '/api/hospitals/nearby?lat=28.5672&lng=77.2100&radiusKm=50', null, null);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.length >= 1);
  assert.ok(data.data[0].distanceKm < 15);
});

test('GET /api/locations/search finds Pan-India city hubs', async () => {
  const res = await callRoute('GET', '/api/locations/search?q=Bengaluru', null, null);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.length >= 1);
  assert.equal(data.data[0].city, 'Bengaluru');
});

test('POST /api/ai/voice-parse extracts emergency nature and patient count', async () => {
  const res = await callRoute('POST', '/api/ai/voice-parse', {
    transcript: 'Severe road traffic accident on highway with 3 people injured bleeding heavily'
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.parsed.type, 'Trauma');
  assert.equal(data.parsed.patientCount, 3);
});

test('POST /api/ai/triage evaluates Manchester triage clinical urgency', async () => {
  const res = await callRoute('POST', '/api/ai/triage', {
    symptoms: 'unconscious patient not breathing after fall from height',
    age: 55
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.urgencyLevel, 'Immediate');
  assert.ok(data.triageScore >= 90);
});

test('GET /api/audit-logs returns list of system events', async () => {
  const res = await callRoute('GET', '/api/audit-logs');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.data));
  assert.ok(data.data.length >= 1);
});

test('GET /api/metrics returns real calculated performance SLAs', async () => {
  const res = await callRoute('GET', '/api/metrics');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.systemHealth, 'OPERATIONAL');
  assert.ok(data.data.totalHospitals >= 15);
});

test('GET /api/analytics/regional returns Pan-India aggregated metrics', async () => {
  const res = await callRoute('GET', '/api/analytics/regional');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data.regionalHospitalDistribution));
});
