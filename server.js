require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./src/config');
const logger = require('./src/logger');
const { initializeDatabase, all, get, run } = require('./src/database');
const { requireAuth, signToken, authenticateUser } = require('./src/auth');
const {
  scoreDispatchReadiness,
  forecastDemand,
  evaluateClinicalTriage,
  parseVoiceEmergencyInput,
  processAIAssistantQuery
} = require('./src/services/aiService');
const routingService = require('./src/services/routingService');
const redisService = require('./src/services/redisService');
const WebSocketService = require('./src/services/websocketService');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');
const {
  buildDashboardPayload,
  createIncidentInput,
  createDispatchDecision,
  recommendBestHospital
} = require('./src/services/dispatchService');

const app = express();
const PORT = config.port || 3011;
let wsService;

initializeDatabase().catch((error) => {
  console.error('Database initialization failed during startup:', error);
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "cdn.jsdelivr.net", "maps.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:", "*.basemaps.cartocdn.com", "*.openstreetmap.org"],
      connectSrc: ["'self'", "ws:", "wss:", "https:"]
    }
  }
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3011').split(',');
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow during local development
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please retry later.' }
}));

function validateIncidentPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Request body is required.';
  }

  const requiredFields = ['title', 'location'];
  for (const field of requiredFields) {
    if (!payload[field] || String(payload[field]).trim() === '') {
      return `Missing or invalid field: ${field}`;
    }
  }

  if (payload.latitude !== undefined && Number.isNaN(Number(payload.latitude))) {
    return 'Latitude must be a valid number.';
  }

  if (payload.longitude !== undefined && Number.isNaN(Number(payload.longitude))) {
    return 'Longitude must be a valid number.';
  }

  return null;
}

async function loadDashboardData() {
  const [incidents, ambulances, hospitals] = await Promise.all([
    all('SELECT * FROM incidents ORDER BY created_at DESC'),
    all('SELECT * FROM ambulances ORDER BY status, vehicle_number'),
    all('SELECT * FROM hospitals ORDER BY available_beds DESC')
  ]);

  return buildDashboardPayload({ incidents, ambulances, hospitals });
}

// ─── Health & Auth ─────────────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  try {
    const incidentCount = await get('SELECT COUNT(*) AS count FROM incidents');
    const ambulanceCount = await get('SELECT COUNT(*) AS count FROM ambulances');
    const hospitalCount = await get('SELECT COUNT(*) AS count FROM hospitals');

    res.json({
      success: true,
      app: 'GoldenHour EDS',
      coverage: 'Pan-India Real-Time Emergency Network',
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      metrics: {
        incidents: incidentCount?.count || 0,
        ambulances: ambulanceCount?.count || 0,
        hospitals: hospitalCount?.count || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Health check failed.' });
  }
});

app.get('/api/ready', async (req, res) => {
  try {
    const incidentCount = await get('SELECT COUNT(*) AS count FROM incidents');
    const ready = !!incidentCount && incidentCount.count >= 0;
    res.status(ready ? 200 : 503).json({
      success: ready,
      ready,
      timestamp: new Date().toISOString(),
      service: 'goldenhour-eds'
    });
  } catch (error) {
    res.status(503).json({ success: false, ready: false, error: 'Service not ready.' });
  }
});

app.get('/api/verify-token', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.sub,
      role: req.user.role,
      name: req.user.name,
      hospital_id: req.user.hospital_id,
      ambulance_id: req.user.ambulance_id
    }
  });
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const user = await authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const token = signToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        hospital_id: user.hospital_id,
        ambulance_id: user.ambulance_id
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Login failed.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, name, role, hospital_id, ambulance_id } = req.body || {};
    if (!username || !password || !name) {
      return res.status(400).json({ success: false, error: 'Username, password, and full name are required.' });
    }

    const existing = await get('SELECT id FROM users WHERE username = ?', [String(username).trim()]);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Username is already registered.' });
    }

    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(password, 10);
    const userId = `USR-${Date.now().toString().slice(-6)}`;
    const userRole = role || 'citizen';

    await run(`
      INSERT INTO users (id, username, password_hash, name, role, hospital_id, ambulance_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, String(username).trim(), hash, name, userRole, hospital_id || null, ambulance_id || null, new Date().toISOString()]);

    const token = signToken({ id: userId, username: String(username).trim(), name, role: userRole, hospital_id, ambulance_id });
    res.status(201).json({
      success: true,
      token,
      user: { id: userId, username: String(username).trim(), name, role: userRole }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Registration failed.' });
  }
});

// ─── Core Data APIs ────────────────────────────────────────────────────────────

app.get('/api/dashboard', async (req, res) => {
  try {
    const payload = await loadDashboardData();
    res.json({ success: true, data: payload });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load dashboard.' });
  }
});

app.get('/api/incidents', async (req, res) => {
  try {
    const { status, severity, region, city } = req.query;
    let query = 'SELECT * FROM incidents WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (severity && severity !== 'all') {
      query += ' AND severity = ?';
      params.push(severity);
    }
    if (region && region !== 'all' && region !== 'national') {
      query += ' AND region = ?';
      params.push(region);
    }
    if (city) {
      query += ' AND (city LIKE ? OR location LIKE ?)';
      params.push(`%${city}%`, `%${city}%`);
    }

    query += ' ORDER BY created_at DESC';
    const incidents = await all(query, params);
    res.json({ success: true, count: incidents.length, data: incidents });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load incidents.' });
  }
});

app.get('/api/ambulances', async (req, res) => {
  try {
    const { status, region, city } = req.query;
    let query = 'SELECT * FROM ambulances WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (region && region !== 'all' && region !== 'national') {
      query += ' AND region = ?';
      params.push(region);
    }
    if (city) {
      query += ' AND city = ?';
      params.push(city);
    }

    query += ' ORDER BY status, vehicle_number';
    const ambulances = await all(query, params);
    res.json({ success: true, count: ambulances.length, data: ambulances });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load ambulances.' });
  }
});

app.get('/api/hospitals', async (req, res) => {
  try {
    const { region, city, state, search, traumaLevel } = req.query;
    let query = 'SELECT * FROM hospitals WHERE 1=1';
    const params = [];

    if (region && region !== 'all' && region !== 'national') {
      query += ' AND region = ?';
      params.push(region);
    }
    if (city) {
      query += ' AND city = ?';
      params.push(city);
    }
    if (state) {
      query += ' AND state = ?';
      params.push(state);
    }
    if (traumaLevel) {
      query += ' AND trauma_level LIKE ?';
      params.push(`%${traumaLevel}%`);
    }
    if (search) {
      query += ' AND (name LIKE ? OR address LIKE ? OR specialty LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY available_beds DESC';
    const hospitals = await all(query, params);
    res.json({ success: true, count: hospitals.length, data: hospitals });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load hospitals.' });
  }
});

app.get('/api/hospitals/nearby', async (req, res) => {
  try {
    const lat = Number(req.query.lat || 26.9124);
    const lng = Number(req.query.lng || 75.7873);
    const radiusKm = Number(req.query.radiusKm || 500); // Pan-India radius
    const limit = Number(req.query.limit || 50);

    const hospitals = await all('SELECT * FROM hospitals');

    const calculated = hospitals.map(h => {
      const dist = routingService.calculateDistanceKm(lat, lng, Number(h.latitude), Number(h.longitude));
      const eta = routingService.calculateETA(dist);
      return {
        ...h,
        distanceKm: dist,
        etaMinutes: eta
      };
    })
    .filter(h => h.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);

    res.json({ success: true, count: calculated.length, origin: { lat, lng }, data: calculated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to calculate nearby hospitals.' });
  }
});

app.get('/api/hospitals/:id', async (req, res) => {
  try {
    const hospital = await get('SELECT * FROM hospitals WHERE id = ?', [req.params.id]);
    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital not found.' });
    }
    res.json({ success: true, data: hospital });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load hospital.' });
  }
});

app.post('/api/incidents', async (req, res) => {
  try {
    const validationError = validateIncidentPayload(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const incident = createIncidentInput(req.body);
    await run(`
      INSERT INTO incidents (id, title, type, severity, status, location, latitude, longitude, region, city, patient_count, eta_minutes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      incident.id,
      incident.title,
      incident.type,
      incident.severity,
      incident.status,
      incident.location,
      incident.latitude,
      incident.longitude,
      incident.region,
      incident.city || incident.location,
      incident.patient_count,
      incident.eta_minutes,
      incident.created_at,
      incident.updated_at
    ]);

    // Insert audit log
    const auditId = `LOG-${Date.now().toString().slice(-6)}`;
    await run(`
      INSERT INTO audit_logs (id, actor, action, category, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      auditId,
      'DISPATCHER',
      `CREATED INCIDENT ${incident.id}`,
      'INCIDENT',
      `${incident.severity.toUpperCase()} - ${incident.title} at ${incident.location} (Patients: ${incident.patient_count})`,
      new Date().toISOString()
    ]);

    const hospitals = await all('SELECT * FROM hospitals');
    const recommendation = recommendBestHospital({
      latitude: incident.latitude,
      longitude: incident.longitude
    }, hospitals);

    if (wsService) {
      wsService.broadcast('incident_created', { incident, nearestHospital: recommendation });
    }

    res.status(201).json({
      success: true,
      message: 'Incident created successfully.',
      incident,
      nearestHospital: recommendation
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create incident.' });
  }
});

app.patch('/api/incidents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, severity, patient_count } = req.body || {};
    const incident = await get('SELECT * FROM incidents WHERE id = ?', [id]);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found.' });
    }

    const updatedStatus = status || incident.status;
    const updatedSeverity = severity || incident.severity;
    const updatedPatients = patient_count !== undefined ? Number(patient_count) : incident.patient_count;
    const now = new Date().toISOString();

    await run(`
      UPDATE incidents SET status = ?, severity = ?, patient_count = ?, updated_at = ? WHERE id = ?
    `, [updatedStatus, updatedSeverity, updatedPatients, now, id]);

    if (wsService) {
      wsService.broadcast('incident_updated', { id, status: updatedStatus, severity: updatedSeverity });
    }

    res.json({ success: true, message: `Incident ${id} updated successfully.` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update incident.' });
  }
});

app.post('/api/dispatch', async (req, res) => {
  try {
    const { incidentId } = req.body || {};
    if (!incidentId) {
      return res.status(400).json({ success: false, error: 'incidentId is required.' });
    }

    const incident = await get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found.' });
    }

    const [ambulances, hospitals] = await Promise.all([
      all('SELECT * FROM ambulances ORDER BY status, vehicle_number'),
      all('SELECT * FROM hospitals ORDER BY available_beds DESC')
    ]);

    const decision = createDispatchDecision(incident, ambulances, hospitals);
    const selectedAmbulance = ambulances.find((item) => item.id === decision.ambulanceId) || ambulances[0];
    const selectedHospital = hospitals.find((item) => item.id === decision.hospitalId) || hospitals[0];
    const aiScore = scoreDispatchReadiness(incident, selectedAmbulance, selectedHospital);
    const demandForecast = forecastDemand(incident.region, new Date().getHours());

    const now = new Date().toISOString();
    await run('UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?', ['dispatched', now, incidentId]);
    if (decision.ambulanceId) {
      await run('UPDATE ambulances SET status = ?, last_updated = ? WHERE id = ?', ['dispatched', now, decision.ambulanceId]);
    }

    const auditId = `LOG-${Date.now().toString().slice(-6)}`;
    await run(`
      INSERT INTO audit_logs (id, actor, action, category, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      auditId,
      'DISPATCH_LEAD',
      `DISPATCHED ${decision.ambulanceNumber || 'AMBULANCE'} → ${incidentId}`,
      'DISPATCH',
      `Hospital: ${decision.hospitalName || 'Apex Trauma'} | ETA: ${decision.etaMinutes}m | Readiness: ${aiScore}%`,
      now
    ]);

    if (wsService) {
      wsService.broadcast('dispatch_update', {
        incidentId,
        ambulance: decision.ambulanceNumber,
        hospital: decision.hospitalName,
        eta: decision.etaMinutes,
        status: 'dispatched',
        aiScore
      });
    }

    res.json({
      success: true,
      data: {
        ...decision,
        aiScore,
        demandForecast,
        routePriority: aiScore > 85 ? 'critical-priority' : 'standard'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Dispatch execution failed.' });
  }
});

app.patch('/api/ambulances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, battery, latitude, longitude } = req.body || {};
    const amb = await get('SELECT * FROM ambulances WHERE id = ?', [id]);
    if (!amb) {
      return res.status(404).json({ success: false, error: 'Ambulance not found.' });
    }

    const now = new Date().toISOString();
    await run(`
      UPDATE ambulances SET
        status = COALESCE(?, status),
        battery = COALESCE(?, battery),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        last_updated = ?
      WHERE id = ?
    `, [status, battery, latitude, longitude, now, id]);

    if (wsService) {
      wsService.broadcast('ambulance_updated', { id, status, battery, latitude, longitude });
    }

    res.json({ success: true, message: `Ambulance ${id} updated.` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update ambulance.' });
  }
});

app.patch('/api/hospitals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { available_beds } = req.body || {};
    if (available_beds === undefined) {
      return res.status(400).json({ success: false, error: 'available_beds is required.' });
    }

    const hosp = await get('SELECT * FROM hospitals WHERE id = ?', [id]);
    if (!hosp) {
      return res.status(404).json({ success: false, error: 'Hospital not found.' });
    }

    await run('UPDATE hospitals SET available_beds = ? WHERE id = ?', [Number(available_beds), id]);

    const auditId = `LOG-${Date.now().toString().slice(-6)}`;
    await run(`
      INSERT INTO audit_logs (id, actor, action, category, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [auditId, 'HOSPITAL_LIAISON', `UPDATED CAPACITY ${id}`, 'HOSPITAL', `${hosp.name} ICU Beds updated to ${available_beds}`, new Date().toISOString()]);

    if (wsService) {
      wsService.broadcast('hospital_updated', { id, available_beds: Number(available_beds) });
    }

    res.json({ success: true, message: `Hospital ${id} bed count updated to ${available_beds}.` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update hospital.' });
  }
});

// ─── Location Engine & Geocoding ────────────────────────────────────────────────

app.get('/api/locations/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim().toLowerCase();
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query parameter q is required.' });
    }

    const PAN_INDIA_LOCATIONS = [
      { name: 'Jaipur Central Command HQ', lat: 26.9124, lng: 75.7873, state: 'Rajasthan', city: 'Jaipur' },
      { name: 'Jaipur International Airport Sector', lat: 26.8289, lng: 75.8056, state: 'Rajasthan', city: 'Jaipur' },
      { name: 'Delhi AIIMS Medical Corridor', lat: 28.5672, lng: 77.2100, state: 'Delhi', city: 'New Delhi' },
      { name: 'Delhi Connaught Place Hub', lat: 28.6315, lng: 77.2167, state: 'Delhi', city: 'New Delhi' },
      { name: 'Mumbai Bandra Western Grid', lat: 19.0514, lng: 72.8294, state: 'Maharashtra', city: 'Mumbai' },
      { name: 'Mumbai BKC Financial Center', lat: 19.0657, lng: 72.8687, state: 'Maharashtra', city: 'Mumbai' },
      { name: 'Bengaluru MG Road Command', lat: 12.9756, lng: 77.6066, state: 'Karnataka', city: 'Bengaluru' },
      { name: 'Bengaluru Whitefield Tech Grid', lat: 12.9698, lng: 77.7500, state: 'Karnataka', city: 'Bengaluru' },
      { name: 'Hyderabad Hitec City Corridor', lat: 17.4435, lng: 78.3772, state: 'Telangana', city: 'Hyderabad' },
      { name: 'Chennai Greams Road Medical Zone', lat: 13.0604, lng: 80.2514, state: 'Tamil Nadu', city: 'Chennai' },
      { name: 'Kolkata Park Street Sector', lat: 22.5510, lng: 88.3530, state: 'West Bengal', city: 'Kolkata' },
      { name: 'Ahmedabad SG Highway Junction', lat: 23.0338, lng: 72.5074, state: 'Gujarat', city: 'Ahmedabad' },
      { name: 'Pune Shivaji Nagar Command', lat: 18.5314, lng: 73.8446, state: 'Maharashtra', city: 'Pune' },
      { name: 'Lucknow Hazratganj Center', lat: 26.8500, lng: 80.9499, state: 'Uttar Pradesh', city: 'Lucknow' },
      { name: 'Chandigarh Sector 17 Plaza', lat: 30.7398, lng: 76.7827, state: 'Chandigarh', city: 'Chandigarh' },
      { name: 'Guwahati Dispur Capital Sector', lat: 26.1445, lng: 91.7898, state: 'Assam', city: 'Guwahati' },
      { name: 'Kochi Marine Drive Sector', lat: 9.9816, lng: 76.2750, state: 'Kerala', city: 'Kochi' },
      { name: 'Bhopal MP Nagar Zone', lat: 23.2324, lng: 77.4338, state: 'Madhya Pradesh', city: 'Bhopal' },
      { name: 'Patna Gandhi Maidan Zone', lat: 25.6207, lng: 85.1415, state: 'Bihar', city: 'Patna' },
      { name: 'Bhubaneswar Master Canteen', lat: 20.2668, lng: 85.8436, state: 'Odisha', city: 'Bhubaneswar' },
      { name: 'Srinagar Lal Chowk Center', lat: 34.0747, lng: 74.8105, state: 'Jammu & Kashmir', city: 'Srinagar' }
    ];

    const results = PAN_INDIA_LOCATIONS.filter(l => 
      l.name.toLowerCase().includes(query) ||
      l.city.toLowerCase().includes(query) ||
      l.state.toLowerCase().includes(query)
    );

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Location search failed.' });
  }
});

// ─── AI Clinical Intelligence & Routing ────────────────────────────────────────

app.post('/api/ai/triage', (req, res) => {
  try {
    const { symptoms, age, vitalSigns } = req.body || {};
    if (!symptoms) {
      return res.status(400).json({ success: false, error: 'Patient symptoms are required for triage evaluation.' });
    }

    const result = evaluateClinicalTriage(symptoms, age, vitalSigns);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Clinical triage evaluation failed.' });
  }
});

app.post('/api/ai/voice-parse', (req, res) => {
  try {
    const { transcript } = req.body || {};
    if (!transcript) {
      return res.status(400).json({ success: false, error: 'Speech transcript is required.' });
    }

    const result = parseVoiceEmergencyInput(transcript);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Voice transcript parsing failed.' });
  }
});

app.post('/api/ai/assistant', async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required.' });
    }

    const [incidents, ambulances, hospitals] = await Promise.all([
      all('SELECT * FROM incidents'),
      all('SELECT * FROM ambulances'),
      all('SELECT * FROM hospitals')
    ]);

    const answer = processAIAssistantQuery(query, { incidents, ambulances, hospitals });
    res.json({ success: true, ...answer });
  } catch (error) {
    res.status(500).json({ success: false, error: 'AI Assistant query processing failed.' });
  }
});

app.post('/api/routing/route', (req, res) => {
  try {
    const { from, to, options } = req.body || {};
    if (!from || !to) {
      return res.status(400).json({ success: false, error: 'Origin (from) and Destination (to) are required.' });
    }

    const route = routingService.buildRoute(from, to, options);
    res.json(route);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Route calculation failed.' });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await all('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load audit logs.' });
  }
});

app.get('/api/metrics', async (req, res) => {
  try {
    const [incidents, ambulances, hospitals] = await Promise.all([
      all('SELECT * FROM incidents'),
      all('SELECT * FROM ambulances'),
      all('SELECT * FROM hospitals')
    ]);

    const totalIncidents = incidents.length;
    const activeIncidents = incidents.filter((i) => i.status === 'active' || i.status === 'dispatched').length;
    const resolvedIncidents = incidents.filter((i) => i.status === 'resolved').length;
    const totalBeds = hospitals.reduce((sum, h) => sum + Number(h.available_beds || 0), 0);
    const availableAmbulances = ambulances.filter((a) => a.status === 'available').length;

    res.json({
      success: true,
      data: {
        totalIncidents,
        activeIncidents,
        resolvedIncidents,
        totalBeds,
        availableAmbulances,
        totalFleet: ambulances.length,
        totalHospitals: hospitals.length,
        avgResponseMinutes: 5.2,
        slaCompliancePercent: 98.8,
        aiDispatchAccuracy: 96.4,
        systemHealth: 'OPERATIONAL'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load metrics.' });
  }
});

app.get('/api/analytics/regional', async (req, res) => {
  try {
    const hospitals = await all('SELECT state, city, COUNT(*) as hospital_count, SUM(available_beds) as available_beds, SUM(capacity) as total_capacity FROM hospitals GROUP BY state, city');
    const ambulances = await all('SELECT city, status, COUNT(*) as count FROM ambulances GROUP BY city, status');
    const incidents = await all('SELECT region, severity, status, COUNT(*) as count FROM incidents GROUP BY region, severity, status');

    res.json({
      success: true,
      data: {
        regionalHospitalDistribution: hospitals,
        fleetReadinessByCity: ambulances,
        incidentTrends: incidents,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Regional analytics calculation failed.' });
  }
});

// Static frontend serving
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

async function bootstrap() {
  await initializeDatabase();
  await redisService.connect();
  
  const httpServer = http.createServer(app);
  wsService = new WebSocketService(httpServer);
  
  httpServer.listen(PORT, () => {
    console.log(`GoldenHour EDS running on http://localhost:${PORT}`);
    logger.info('Server started', { port: PORT, env: process.env.NODE_ENV });
  });
}

if (require.main === module) {
  bootstrap();
}

module.exports = app;
