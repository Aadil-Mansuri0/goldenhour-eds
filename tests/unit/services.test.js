const test = require('node:test');
const assert = require('node:assert/strict');
const {
  scoreDispatchReadiness,
  forecastDemand,
  evaluateClinicalTriage,
  parseVoiceEmergencyInput,
  processAIAssistantQuery
} = require('../../src/services/aiService');
const {
  getDistanceKm,
  estimateEtaKm,
  normalizeSeverity
} = require('../../src/services/dispatchService');
const routingService = require('../../src/services/routingService');
const { verifyPassword, signToken } = require('../../src/auth');

test('dispatchService: getDistanceKm returns valid distance for Indian coordinates', () => {
  const dist = getDistanceKm(26.9124, 75.7873, 28.5672, 77.2100);
  assert.ok(dist > 220 && dist < 280, `Expected ~240km, got ${dist}`);
});

test('dispatchService: estimateEtaKm returns realistic minutes', () => {
  const eta = estimateEtaKm(10);
  assert.ok(eta > 0 && eta <= 30);
});

test('dispatchService: normalizeSeverity handles various inputs', () => {
  assert.equal(normalizeSeverity('CRITICAL'), 'critical');
  assert.equal(normalizeSeverity('stable'), 'low');
  assert.equal(normalizeSeverity('unknown'), 'medium');
});

test('aiService: scoreDispatchReadiness returns score bounded below 100', () => {
  const incident = { severity: 'critical' };
  const ambulance = { battery: 95 };
  const hospital = { available_beds: 30, trauma_level: 'Level 1 Apex' };
  const score = scoreDispatchReadiness(incident, ambulance, hospital);
  assert.ok(score >= 70 && score <= 99);
});

test('aiService: forecastDemand returns integer percent', () => {
  const demand = forecastDemand('national', 9);
  assert.ok(demand >= 50 && demand <= 99);
});

test('aiService: evaluateClinicalTriage classifies P1 Resuscitation accurately', () => {
  const res = evaluateClinicalTriage('unconscious patient not breathing after collision', 55, { oxygenSaturation: 82 });
  assert.equal(res.success, true);
  assert.equal(res.urgencyLevel, 'Immediate');
  assert.equal(res.targetGoldenHourWindowMinutes, 15);
  assert.ok(res.traumaLevelRequired.includes('Level 1'));
});

test('aiService: evaluateClinicalTriage classifies P2 Very Urgent cardiac chest pain', () => {
  const res = evaluateClinicalTriage('crushing retrosternal chest pain radiating to left arm', 62);
  assert.equal(res.success, true);
  assert.equal(res.urgencyLevel, 'Very Urgent');
  assert.equal(res.targetGoldenHourWindowMinutes, 30);
});

test('aiService: parseVoiceEmergencyInput extracts nature and count', () => {
  const res = parseVoiceEmergencyInput('Severe car crash on highway with 4 injured people bleeding');
  assert.equal(res.success, true);
  assert.equal(res.parsed.type, 'Trauma');
  assert.equal(res.parsed.patientCount, 4);
});

test('aiService: processAIAssistantQuery answers hospital capacity grounded in context', () => {
  const answer = processAIAssistantQuery('What is the ICU bed capacity?', {
    hospitals: [{ name: 'AIIMS', available_beds: 40, capacity: 500 }],
    ambulances: [],
    incidents: []
  });
  assert.equal(answer.type, 'hospital_capacity');
  assert.ok(answer.answer.includes('40 available ICU/Trauma beds'));
});

test('routingService: buildRoute generates Pan-India emergency corridor payload', () => {
  const route = routingService.buildRoute(
    { latitude: 26.9124, longitude: 75.7873, name: 'Jaipur Command' },
    { latitude: 28.5672, longitude: 77.2100, name: 'AIIMS New Delhi' }
  );
  assert.ok(route.distanceKm > 200);
  assert.equal(route.optimized, true);
  assert.ok(Array.isArray(route.coordinates));
  assert.ok(route.coordinates.length >= 4);
});

test('auth: verifyPassword authenticates valid demo users', () => {
  const user = verifyPassword('dispatcher', 'goldenhour@123');
  assert.ok(user);
  assert.equal(user.role, 'dispatcher');

  const invalid = verifyPassword('dispatcher', 'wrongpass');
  assert.equal(invalid, null);
});

test('auth: signToken produces JWT string', () => {
  const token = signToken({ username: 'dispatcher', role: 'dispatcher', name: 'Test User' });
  assert.ok(typeof token === 'string');
  assert.ok(token.length > 20);
});
