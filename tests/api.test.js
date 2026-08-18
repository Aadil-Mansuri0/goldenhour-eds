const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

const { closeDatabase } = require('../src/database');

let server;
const PORT = 3011;
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

async function callRoute(method, path, auth = false, token = dispatchToken) {
  const response = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    method,
    headers: auth ? { Authorization: `Bearer ${token}` } : {}
  });
  return response;
}

test('health endpoint responds successfully', async () => {
  const response = await callRoute('GET', '/api/health');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.success, true);
  assert.equal(data.status, 'ok');
});

test('readiness endpoint returns ready status', async () => {
  const response = await callRoute('GET', '/api/ready');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.success, true);
  assert.equal(data.ready, true);
});

test('dashboard endpoint provides dispatch data', async () => {
  const response = await callRoute('GET', '/api/dashboard');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.success, true);
  assert.ok(data.data.map.incidents.length >= 1);
});

test('incident creation requires auth', async () => {
  const response = await callRoute('POST', '/api/incidents', false, null);
  assert.equal(response.status, 401);
});

test('incident creation succeeds with valid dispatcher auth', async () => {
  const response = await fetch(`http://127.0.0.1:${PORT}/api/incidents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${dispatchToken}`
    },
    body: JSON.stringify({
      title: 'Test case incident',
      location: 'Test location',
      latitude: 26.9124,
      longitude: 75.7873,
      severity: 'medium',
      patient_count: 2
    })
  });

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.success, true);
  assert.ok(data.incident.id);
});
