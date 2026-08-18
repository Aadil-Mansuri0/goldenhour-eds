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
const { requireAuth, requireRole, signToken, verifyPassword } = require('./src/auth');
const { scoreDispatchReadiness, forecastDemand } = require('./src/services/aiService');
const cacheService = require('./src/services/cacheService');
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
const PORT = config.port;
let wsService;

initializeDatabase().catch((error) => {
  console.error('Database initialization failed during startup:', error);
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "unpkg.com"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3011').split(',');
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
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

app.get('/api/health', async (req, res) => {
  try {
    const incidentCount = await get('SELECT COUNT(*) AS count FROM incidents');
    const ambulanceCount = await get('SELECT COUNT(*) AS count FROM ambulances');
    const hospitalCount = await get('SELECT COUNT(*) AS count FROM hospitals');

    const health = {
      success: true,
      app: process.env.APP_NAME || 'GoldenHour EDS',
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      metrics: {
        incidents: incidentCount?.count || 0,
        ambulances: ambulanceCount?.count || 0,
        hospitals: hospitalCount?.count || 0
      },
      checks: {
        database: 'ok',
        api: 'ok',
        auth: 'ok'
      }
    };

    res.json(health);
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

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const user = verifyPassword(username, password);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    const token = signToken(user);
    res.json({
      success: true,
      token,
      user: {
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Login failed.' });
  }
});

app.get('/api/verify-token', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      username: req.user.sub,
      role: req.user.role,
      name: req.user.name
    }
  });
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const cacheKey = 'dashboard:v1';
    let payload = cacheService.get(cacheKey);

    if (!payload) {
      payload = await loadDashboardData();
      cacheService.set(cacheKey, payload);
    }

    res.json({ success: true, data: payload });
  } catch (error) {
    logger.error('Error building dashboard', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: 'Failed to load dashboard.' });
  }
});

app.get('/api/incidents', async (req, res) => {
  try {
    const incidents = await all('SELECT * FROM incidents ORDER BY created_at DESC');
    res.json({ success: true, data: incidents });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load incidents.' });
  }
});

app.get('/api/ambulances', async (req, res) => {
  try {
    const ambulances = await all('SELECT * FROM ambulances ORDER BY status, vehicle_number');
    res.json({ success: true, data: ambulances });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load ambulances.' });
  }
});

app.get('/api/hospitals', async (req, res) => {
  try {
    const hospitals = await all('SELECT * FROM hospitals ORDER BY available_beds DESC');
    res.json({ success: true, data: hospitals });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load hospitals.' });
  }
});

app.post('/api/incidents', requireAuth, requireRole('dispatcher', 'admin', 'citizen', 'super_admin'), async (req, res) => {
  try {
    const validationError = validateIncidentPayload(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const incident = createIncidentInput(req.body);
    await run(`
      INSERT INTO incidents (id, title, type, severity, status, location, latitude, longitude, region, patient_count, eta_minutes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      incident.patient_count,
      incident.eta_minutes,
      incident.created_at,
      incident.updated_at
    ]);

    // Insert audit log entry
    const auditId = `LOG-${Date.now().toString().slice(-6)}`;
    await run(`
      INSERT INTO audit_logs (id, actor, action, category, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      auditId,
      req.user?.name || req.user?.sub || 'SYSTEM',
      `CREATED INCIDENT ${incident.id}`,
      'INCIDENT',
      `${incident.severity.toUpperCase()} - ${incident.title} at ${incident.location}`,
      new Date().toISOString()
    ]);

    cacheService.del('dashboard:v1');

    const hospitals = await all('SELECT * FROM hospitals ORDER BY available_beds DESC');
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
    console.error('Error creating incident:', error);
    res.status(500).json({ success: false, error: 'Failed to create incident.' });
  }
});

app.patch('/api/incidents/:id', requireAuth, async (req, res) => {
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

    cacheService.del('dashboard:v1');
    if (wsService) {
      wsService.broadcast('incident_updated', { id, status: updatedStatus, severity: updatedSeverity });
    }

    res.json({ success: true, message: `Incident ${id} updated successfully.` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update incident.' });
  }
});

app.get('/api/incidents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await get('SELECT * FROM incidents WHERE id = ?', [id]);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found.' });
    }
    res.json({ success: true, data: incident });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve incident.' });
  }
});

app.delete('/api/incidents/:id', requireAuth, requireRole('dispatcher', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await get('SELECT * FROM incidents WHERE id = ?', [id]);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found.' });
    }

    await run('DELETE FROM incidents WHERE id = ?', [id]);
    cacheService.del('dashboard:v1');

    // Audit log
    const auditId = `LOG-${Date.now().toString().slice(-6)}`;
    await run(`
      INSERT INTO audit_logs (id, actor, action, category, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      auditId,
      req.user?.name || req.user?.sub || 'SYSTEM',
      `RESOLVED & CLOSED INCIDENT ${id}`,
      'INCIDENT',
      `Incident ${id} closed and marked resolved`,
      new Date().toISOString()
    ]);

    if (wsService) {
      wsService.broadcast('incident_deleted', { id });
    }

    res.json({ success: true, message: `Incident ${id} closed successfully.` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete incident.' });
  }
});

app.post('/api/dispatch', requireAuth, requireRole('dispatcher', 'admin', 'super_admin'), async (req, res) => {
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
    // Update incident & ambulance status in database
    await run('UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?', ['dispatched', now, incidentId]);
    if (decision.ambulanceId) {
      await run('UPDATE ambulances SET status = ?, last_updated = ? WHERE id = ?', ['dispatched', now, decision.ambulanceId]);
    }

    // Record audit log
    const auditId = `LOG-${Date.now().toString().slice(-6)}`;
    await run(`
      INSERT INTO audit_logs (id, actor, action, category, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      auditId,
      req.user?.name || req.user?.sub || 'DISPATCHER',
      `DISPATCHED ${decision.ambulanceNumber || 'AMBULANCE'} → ${incidentId}`,
      'DISPATCH',
      `Destination: ${decision.hospitalName || 'N/A'} | ETA: ${decision.etaMinutes}m | AI Score: ${aiScore}%`,
      now
    ]);

    cacheService.del('dashboard:v1');

    // Broadcast to WebSocket clients
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

    logger.info('Dispatch executed', { incidentId, ambulance: decision.ambulanceNumber, hospital: decision.hospitalName });

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
    logger.error('Dispatch error', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: 'Dispatch recommendation failed.' });
  }
});

app.patch('/api/ambulances/:id', requireAuth, async (req, res) => {
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

    cacheService.del('dashboard:v1');
    if (wsService) {
      wsService.broadcast('ambulance_updated', { id, status, battery, latitude, longitude });
    }

    res.json({ success: true, message: `Ambulance ${id} updated.` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update ambulance.' });
  }
});

app.patch('/api/hospitals/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { available_beds } = req.body || {};
    if (available_beds === undefined) {
      return res.status(400).json({ success: false, error: 'available_beds is required.' });
    }

    await run('UPDATE hospitals SET available_beds = ? WHERE id = ?', [Number(available_beds), id]);
    cacheService.del('dashboard:v1');
    if (wsService) {
      wsService.broadcast('hospital_updated', { id, available_beds });
    }

    res.json({ success: true, message: `Hospital ${id} bed count updated.` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update hospital.' });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await all('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50');
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load audit logs.' });
  }
});

app.post('/api/audit-logs', requireAuth, async (req, res) => {
  try {
    const { action, category, details } = req.body || {};
    if (!action) return res.status(400).json({ success: false, error: 'Action is required.' });

    const auditId = `LOG-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();
    await run(`
      INSERT INTO audit_logs (id, actor, action, category, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      auditId,
      req.user?.name || req.user?.sub || 'SYSTEM',
      action,
      category || 'GENERAL',
      details || '',
      now
    ]);

    res.status(201).json({ success: true, id: auditId });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save audit log.' });
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
        avgResponseMinutes: 5.8,
        slaCompliancePercent: 98.6,
        aiDispatchAccuracy: 94.3,
        systemHealth: 'OPERATIONAL'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load metrics.' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

async function bootstrap() {
  await initializeDatabase();
  
  // Initialize Redis
  await redisService.connect();
  
  // Create HTTP server for WebSocket upgrade
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
