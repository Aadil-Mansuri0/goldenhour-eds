const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreDispatchReadiness, forecastDemand } = require('../../src/services/aiService');
const { getDistanceKm, estimateEtaKm, recommendBestHospital, createDispatchDecision, normalizeSeverity } = require('../../src/services/dispatchService');
const routingService = require('../../src/services/routingService');
const { verifyPassword, signToken } = require('../../src/auth');

test('dispatchService: getDistanceKm returns valid distance', () => {
  const dist = getDistanceKm(26.9124, 75.7873, 26.9180, 75.7942);
  assert.ok(dist > 0 && dist < 5);
});

test('dispatchService: estimateEtaKm returns positive minutes', () => {
  const eta = estimateEtaKm(10);
  assert.ok(eta > 0);
});

test('dispatchService: normalizeSeverity handles various inputs', () => {
  assert.equal(normalizeSeverity('CRITICAL'), 'critical');
  assert.equal(normalizeSeverity('stable'), 'low');
  assert.equal(normalizeSeverity('unknown'), 'medium');
});

test('aiService: scoreDispatchReadiness returns score bounded below 100', () => {
  const incident = { severity: 'critical' };
  const ambulance = { battery: 90 };
  const hospital = { available_beds: 20 };
  const score = scoreDispatchReadiness(incident, ambulance, hospital);
  assert.ok(score >= 70 && score <= 99);
});

test('aiService: forecastDemand returns integer percent', () => {
  const demand = forecastDemand('jaipur', 9);
  assert.ok(demand >= 50 && demand <= 99);
});

test('routingService: buildRoute generates route payload', () => {
  const route = routingService.buildRoute(
    { latitude: 26.9124, longitude: 75.7873 },
    { latitude: 26.9180, longitude: 75.7942 }
  );
  assert.ok(route.distanceKm > 0);
  assert.equal(route.optimized, true);
});

test('auth: verifyPassword authenticates valid demo users', () => {
  const user = verifyPassword('dispatcher', 'goldenhour@123');
  assert.ok(user);
  assert.equal(user.role, 'dispatcher');

  const invalid = verifyPassword('dispatcher', 'wrongpass');
  assert.equal(invalid, null);
});

test('auth: signToken produces JWT string', () => {
  const token = signToken({ username: 'dispatcher', role: 'dispatcher', name: 'Test' });
  assert.ok(typeof token === 'string');
  assert.ok(token.length > 20);
});
