const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbDir = path.dirname(process.env.DB_PATH || './data/goldenhour.db');
const dbFile = process.env.DB_PATH || './data/goldenhour.db';

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log(`Connected to SQLite database at ${dbFile}`);
  }
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      location TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      region TEXT NOT NULL,
      patient_count INTEGER NOT NULL,
      eta_minutes REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS ambulances (
      id TEXT PRIMARY KEY,
      vehicle_number TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      region TEXT NOT NULL,
      battery INTEGER NOT NULL,
      crew_count INTEGER NOT NULL,
      eta_minutes REAL,
      last_updated TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      region TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      available_beds INTEGER NOT NULL,
      trauma_level TEXT NOT NULL,
      specialty TEXT NOT NULL,
      eta_minutes REAL
    )
  `);

  const incidentCount = await get('SELECT COUNT(*) AS count FROM incidents');
  if ((incidentCount?.count || 0) === 0) {
    await run(`INSERT INTO incidents (id, title, type, severity, status, location, latitude, longitude, region, patient_count, eta_minutes, created_at, updated_at) VALUES
      ('INC-1001', 'Road Traffic Collision', 'Trauma', 'critical', 'active', 'NH-48, Jaipur', 26.9124, 75.7873, 'jaipur', 6, 5.8, '2026-08-16T08:00:00Z', '2026-08-16T08:03:00Z'),
      ('INC-1002', 'Chest Pain', 'Cardiac', 'high', 'en-route', 'Vaishali Nagar', 26.9180, 75.7942, 'jaipur', 1, 7.3, '2026-08-16T08:10:00Z', '2026-08-16T08:12:00Z'),
      ('INC-1003', 'Respiratory Distress', 'Pulmonary', 'medium', 'active', 'Sanganer', 26.8521, 75.8124, 'jaipur', 2, 9.2, '2026-08-16T08:06:00Z', '2026-08-16T08:08:00Z'),
      ('INC-1004', 'Fall Injury', 'Trauma', 'low', 'stable', 'Malviya Nagar', 26.8962, 75.7901, 'jaipur', 1, 11.5, '2026-08-16T08:22:00Z', '2026-08-16T08:23:00Z')
    `);
  }

  const ambulanceCount = await get('SELECT COUNT(*) AS count FROM ambulances');
  if ((ambulanceCount?.count || 0) === 0) {
    await run(`INSERT INTO ambulances (id, vehicle_number, type, status, latitude, longitude, region, battery, crew_count, eta_minutes, last_updated) VALUES
      ('AMB-101', 'RJ14 AA 2211', 'ALS', 'available', 26.9124, 75.7873, 'jaipur', 92, 2, 4.8, '2026-08-16T08:15:00Z'),
      ('AMB-102', 'RJ14 AB 4432', 'BLS', 'en-route', 26.9050, 75.7780, 'jaipur', 81, 2, 6.1, '2026-08-16T08:18:00Z'),
      ('AMB-103', 'RJ14 AC 5567', 'ALS', 'dispatched', 26.9180, 75.7942, 'jaipur', 76, 3, 3.9, '2026-08-16T08:20:00Z'),
      ('AMB-104', 'RJ14 AD 7891', 'BLS', 'available', 26.9278, 75.8081, 'jaipur', 89, 2, 5.2, '2026-08-16T08:25:00Z'),
      ('AMB-105', 'RJ14 AE 1167', 'ALS', 'available', 26.8994, 75.7645, 'jaipur', 70, 2, 8.4, '2026-08-16T08:10:00Z')
    `);
  }

  const hospitalCount = await get('SELECT COUNT(*) AS count FROM hospitals');
  if ((hospitalCount?.count || 0) === 0) {
    await run(`INSERT INTO hospitals (id, name, type, latitude, longitude, region, capacity, available_beds, trauma_level, specialty, eta_minutes) VALUES
      ('HSP-201', 'Mahatma Gandhi Hospital', 'public', 26.9221, 75.7778, 'jaipur', 420, 34, 'Level 1', 'trauma, cardiac', 6.4),
      ('HSP-202', 'Fortis Hospital Jaipur', 'private', 26.9072, 75.8004, 'jaipur', 310, 21, 'Level 2', 'multi-specialty', 5.9),
      ('HSP-203', 'SMS Hospital', 'public', 26.8910, 75.7970, 'jaipur', 510, 42, 'Level 1', 'trauma, emergency', 7.1),
      ('HSP-204', 'NIMS Jaipur', 'private', 26.9326, 75.8260, 'jaipur', 260, 17, 'Level 2', 'critical care', 9.3)
    `);
  }

  // Create audit_logs table
  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      category TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL
    )
  `);

  // Create indexes for performance
  await run('CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)');
  await run('CREATE INDEX IF NOT EXISTS idx_incidents_region ON incidents(region)');
  await run('CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_ambulances_status ON ambulances(status)');
  await run('CREATE INDEX IF NOT EXISTS idx_ambulances_region ON ambulances(region)');
  await run('CREATE INDEX IF NOT EXISTS idx_hospitals_region ON hospitals(region)');
  await run('CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)');
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = {
  db,
  initializeDatabase,
  closeDatabase,
  run,
  all,
  get
};
