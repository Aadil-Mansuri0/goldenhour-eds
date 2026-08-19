const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

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

async function addColumnIfNotExists(table, column, definition) {
  try {
    const columns = await all(`PRAGMA table_info(${table})`);
    const exists = columns.some((c) => c.name === column);
    if (!exists) {
      await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (_err) {
    // ignore if table doesn't exist yet
  }
}

async function initializeDatabase() {
  // 1. Users Table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      hospital_id TEXT,
      ambulance_id TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // 2. Incidents Table
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
      city TEXT,
      patient_count INTEGER NOT NULL,
      eta_minutes REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 3. Ambulances Table
  await run(`
    CREATE TABLE IF NOT EXISTS ambulances (
      id TEXT PRIMARY KEY,
      vehicle_number TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      region TEXT NOT NULL,
      city TEXT,
      battery INTEGER NOT NULL,
      crew_count INTEGER NOT NULL,
      eta_minutes REAL,
      last_updated TEXT NOT NULL
    )
  `);

  // 4. Hospitals Table (Pan-India)
  await run(`
    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      region TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'India',
      city TEXT NOT NULL DEFAULT 'Jaipur',
      pincode TEXT,
      capacity INTEGER NOT NULL,
      available_beds INTEGER NOT NULL,
      trauma_level TEXT NOT NULL,
      specialty TEXT NOT NULL,
      eta_minutes REAL,
      data_source TEXT DEFAULT 'National Health Portal / Verified Registry',
      last_updated TEXT,
      data_confidence REAL DEFAULT 0.98
    )
  `);

  // Column migrations for legacy hospitals table if needed
  await addColumnIfNotExists('hospitals', 'address', 'TEXT');
  await addColumnIfNotExists('hospitals', 'phone', 'TEXT');
  await addColumnIfNotExists('hospitals', 'state', "TEXT NOT NULL DEFAULT 'India'");
  await addColumnIfNotExists('hospitals', 'city', "TEXT NOT NULL DEFAULT 'Jaipur'");
  await addColumnIfNotExists('hospitals', 'pincode', 'TEXT');
  await addColumnIfNotExists('hospitals', 'data_source', "TEXT DEFAULT 'National Health Portal / Verified Registry'");
  await addColumnIfNotExists('hospitals', 'last_updated', 'TEXT');
  await addColumnIfNotExists('hospitals', 'data_confidence', 'REAL DEFAULT 0.98');

  await addColumnIfNotExists('incidents', 'city', 'TEXT');
  await addColumnIfNotExists('ambulances', 'city', 'TEXT');

  // 5. Audit Logs Table
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

  // Seed default Users if empty
  const userCount = await get('SELECT COUNT(*) AS count FROM users');
  if ((userCount?.count || 0) === 0) {
    const defaultUsers = [
      { id: 'USR-001', username: 'dispatcher', pass: 'goldenhour@123', name: 'Command Dispatcher Ops', role: 'dispatcher' },
      { id: 'USR-002', username: 'admin', pass: 'admin@golden', name: 'Operations Admin Lead', role: 'admin' },
      { id: 'USR-003', username: 'hospital', pass: 'hospital@2026', name: 'SMS Hospital Liaison', role: 'hospital', hospital_id: 'HSP-JPR-01' },
      { id: 'USR-004', username: 'ambulance', pass: 'ambulance@123', name: 'Ambulance Crew Lead (RJ14)', role: 'ambulance', ambulance_id: 'AMB-JPR-01' },
      { id: 'USR-005', username: 'citizen', pass: 'citizen@123', name: 'Rahul Sharma (Citizen)', role: 'citizen' },
      { id: 'USR-006', username: 'superadmin', pass: 'superadmin@123', name: 'National Super Admin', role: 'super_admin' }
    ];

    for (const u of defaultUsers) {
      const hash = bcrypt.hashSync(u.pass, 10);
      await run(`
        INSERT INTO users (id, username, password_hash, name, role, hospital_id, ambulance_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [u.id, u.username, hash, u.name, u.role, u.hospital_id || null, u.ambulance_id || null, new Date().toISOString()]);
    }
  }

  // Seed Pan-India Hospital Network if count is low
  const hospitalCount = await get('SELECT COUNT(*) AS count FROM hospitals');
  if ((hospitalCount?.count || 0) < 15) {
    await run('DELETE FROM hospitals');

    const PAN_INDIA_HOSPITALS = [
      // 1. Jaipur (Rajasthan)
      ['HSP-JPR-01', 'SMS Super Specialty Trauma Hospital', 'Public Apex Center', 'JLN Marg, Ashok Nagar, Jaipur', '+91 141 251 8888', 26.8910, 75.8080, 'jaipur', 'Rajasthan', 'Jaipur', '302004', 520, 46, 'Level 1 Apex', 'Comprehensive Polytrauma, Interventional Cardiology, Neurosurgery, Burns', 4.5, 'Rajasthan Medical Directorate', '2026-08-19T08:00:00Z', 0.99],
      ['HSP-JPR-02', 'Fortis Escorts Heart & Trauma Institute', 'Private Multi-Specialty', 'Jawaharlal Nehru Marg, Malviya Nagar, Jaipur', '+91 141 254 7000', 26.8480, 75.8020, 'jaipur', 'Rajasthan', 'Jaipur', '302017', 340, 24, 'Level 1 Trauma', 'Interventional Cardiology, Emergency Surgery, Critical Care', 5.8, 'NABH Accredited Registry', '2026-08-19T08:00:00Z', 0.98],
      ['HSP-JPR-03', 'Mahatma Gandhi Medical College & Hospital', 'Tertiary Academic Center', 'RIICO Institutional Area, Sitapura, Jaipur', '+91 141 277 1777', 26.7720, 75.8560, 'jaipur', 'Rajasthan', 'Jaipur', '302022', 480, 38, 'Level 2 Trauma', 'Critical Care, Comprehensive Stroke Center, Pediatric ICU', 8.2, 'NABH Accredited Registry', '2026-08-19T08:00:00Z', 0.97],
      ['HSP-JPR-04', 'NIMS Critical Care & Emergency Hospital', 'Regional Emergency Center', 'Delhi-Jaipur Highway, Shobha Nagar, Jaipur', '+91 141 260 5000', 27.0120, 75.9250, 'jaipur', 'Rajasthan', 'Jaipur', '303121', 280, 19, 'Level 2 Trauma', 'Trauma Stabilization, Toxicology, Orthopedics', 9.5, 'NHM Rajasthan Registry', '2026-08-19T08:00:00Z', 0.96],

      // 2. Delhi NCR (Delhi)
      ['HSP-DEL-01', 'AIIMS New Delhi Apex Trauma Center', 'National Apex Center', 'Ansari Nagar East, Ring Road, New Delhi', '+91 11 2658 8500', 28.5672, 77.2100, 'delhi', 'Delhi', 'New Delhi', '110029', 650, 52, 'Level 1 Apex', 'Comprehensive Polytrauma, Neurosurgery, Organ Transplant, Critical Care', 5.0, 'MoHFW Central Registry', '2026-08-19T08:00:00Z', 1.0],
      ['HSP-DEL-02', 'Safdarjung Hospital Emergency Care', 'Central Government Tertiary', 'Ring Road, Opposite AIIMS, New Delhi', '+91 11 2616 5060', 28.5714, 77.2075, 'delhi', 'Delhi', 'New Delhi', '110029', 580, 39, 'Level 1 Trauma', 'Burns, Emergency General Surgery, Orthopedic Trauma, Pulmonary ICU', 6.2, 'Central Health Portal', '2026-08-19T08:00:00Z', 0.99],
      ['HSP-DEL-03', 'Max Super Speciality Hospital Saket', 'Private Multi-Specialty', '1, 2 Press Enclave Marg, Saket, New Delhi', '+91 11 2651 5050', 28.5282, 77.2115, 'delhi', 'Delhi', 'New Delhi', '110017', 420, 31, 'Level 1 Trauma', 'Interventional Cardiology, Acute Stroke Unit, Oncology ICU', 7.1, 'NABH Registry', '2026-08-19T08:00:00Z', 0.98],

      // 3. Mumbai (Maharashtra)
      ['HSP-MUM-01', 'KEM Hospital & Seth GS Medical College', 'Municipal Apex Center', 'Acharya Donde Marg, Parel, Mumbai', '+91 22 2410 7000', 19.0028, 72.8428, 'mumbai', 'Maharashtra', 'Mumbai', '400012', 620, 41, 'Level 1 Apex', 'Disaster Response, Cardiovascular Surgery, Polytrauma Resuscitation', 5.5, 'BMC Emergency Registry', '2026-08-19T08:00:00Z', 0.99],
      ['HSP-MUM-02', 'Lilavati Hospital & Research Centre', 'Private Multi-Specialty', 'A-791, Bandra Reclamation, Bandra West, Mumbai', '+91 22 2675 1000', 19.0514, 72.8294, 'mumbai', 'Maharashtra', 'Mumbai', '400050', 350, 28, 'Level 1 Trauma', 'Interventional Cardiology, Stroke Care, Intensive Critical Care', 4.9, 'NABH Registry', '2026-08-19T08:00:00Z', 0.98],
      ['HSP-MUM-03', 'Kokilaben Dhirubhai Ambani Hospital', 'Private Quaternary Care', 'Rao Saheb Achutrao Patwardhan Marg, Andheri West, Mumbai', '+91 22 4269 6969', 19.1311, 72.8258, 'mumbai', 'Maharashtra', 'Mumbai', '400053', 450, 35, 'Level 1 Trauma', 'Robotic Emergency Surgery, Cardiac Arrest Center, Pediatric Trauma', 6.8, 'NABH Quaternary Registry', '2026-08-19T08:00:00Z', 0.99],

      // 4. Bengaluru (Karnataka)
      ['HSP-BLR-01', 'Manipal Hospital Old Airport Road', 'Private Multi-Specialty', '98, HAL Old Airport Rd, Kodihalli, Bengaluru', '+91 80 2502 4444', 12.9592, 77.6499, 'bengaluru', 'Karnataka', 'Bengaluru', '560017', 480, 36, 'Level 1 Apex', 'Polytrauma, Interventional Cardiology, Neurocritical Care, ECMO', 5.2, 'Karnataka Health Portal', '2026-08-19T08:00:00Z', 0.99],
      ['HSP-BLR-02', 'Victoria Hospital & Bangalore Medical College', 'Government Apex Center', 'Fort Road, Near City Market, Bengaluru', '+91 80 2670 1150', 12.9634, 77.5756, 'bengaluru', 'Karnataka', 'Bengaluru', '560002', 550, 42, 'Level 1 Trauma', 'Emergency Resuscitation, Burns ICU, Orthopedics, Toxicology', 6.0, 'Govt of Karnataka Health', '2026-08-19T08:00:00Z', 0.98],

      // 5. Hyderabad (Telangana)
      ['HSP-HYD-01', "Nizam's Institute of Medical Sciences (NIMS)", 'State Autonomous Apex', 'Punjagutta, Hyderabad', '+91 40 2348 9000', 17.4225, 78.4526, 'hyderabad', 'Telangana', 'Hyderabad', '500082', 500, 40, 'Level 1 Apex', 'Cardiac Emergencies, Neurosurgery, Organ Transplants, Trauma', 5.6, 'Telangana Health Registry', '2026-08-19T08:00:00Z', 0.99],
      ['HSP-HYD-02', 'Apollo Health City Jubilee Hills', 'Private Tertiary Center', 'Road No. 72, Film Nagar, Jubilee Hills, Hyderabad', '+91 40 2360 7777', 17.4178, 78.4116, 'hyderabad', 'Telangana', 'Hyderabad', '500033', 420, 32, 'Level 1 Trauma', 'Comprehensive Stroke Center, 24/7 STEMI Cath Lab, Critical Care', 6.4, 'NABH Registry', '2026-08-19T08:00:00Z', 0.98],

      // 6. Chennai (Tamil Nadu)
      ['HSP-MAA-01', 'Rajiv Gandhi Government General Hospital', 'State Apex Hospital', 'EVR Periyar Salai, Park Town, Chennai', '+91 44 2530 5000', 13.0805, 80.2778, 'chennai', 'Tamil Nadu', 'Chennai', '600003', 600, 48, 'Level 1 Apex', 'Major Trauma, Cardiac Arrest Resuscitation, Multi-Organ Support', 5.1, 'Tamil Nadu Health Systems Project', '2026-08-19T08:00:00Z', 0.99],
      ['HSP-MAA-02', 'Apollo Hospitals Greams Road', 'Private Tertiary Center', '21 Greams Lane, Off Greams Road, Chennai', '+91 44 2829 0200', 13.0604, 80.2514, 'chennai', 'Tamil Nadu', 'Chennai', '600006', 440, 29, 'Level 1 Trauma', 'Interventional Cardiology, Complex Polytrauma, Neuro ICU', 5.9, 'NABH Registry', '2026-08-19T08:00:00Z', 0.98],

      // 7. Kolkata (West Bengal)
      ['HSP-CCU-01', 'IPGMER & SSKM Hospital', 'State Apex Center', '244 AJC Bose Road, Bhowanipore, Kolkata', '+91 33 2223 1589', 22.5398, 88.3444, 'kolkata', 'West Bengal', 'Kolkata', '700020', 580, 45, 'Level 1 Apex', 'Trauma Resuscitation, Burns Unit, Neurosurgery, Critical Care', 5.4, 'West Bengal Health Dept', '2026-08-19T08:00:00Z', 0.99],
      ['HSP-CCU-02', 'Apollo Multispeciality Hospitals Kolkata', 'Private Multi-Specialty', '58 Canal Circular Road, Kadapara, Kolkata', '+91 33 2320 3040', 22.5768, 88.4035, 'kolkata', 'West Bengal', 'Kolkata', '700054', 400, 30, 'Level 1 Trauma', 'Interventional Cardiology, Acute Stroke Care, Trauma ICU', 6.5, 'NABH Registry', '2026-08-19T08:00:00Z', 0.98],

      // 8. Ahmedabad (Gujarat)
      ['HSP-AMD-01', 'Ahmedabad Civil Hospital', 'State Apex Trauma Center', 'Asarwa, Ahmedabad', '+91 79 2268 3721', 23.0525, 72.5976, 'ahmedabad', 'Gujarat', 'Ahmedabad', '380016', 650, 55, 'Level 1 Apex', 'Major Disaster Resuscitation, Polytrauma, Cardiac Care, Toxicology', 4.8, 'Gujarat Health Portal', '2026-08-19T08:00:00Z', 0.99],
      ['HSP-AMD-02', 'Apollo Hospitals International Gandhinagar', 'Private Multi-Specialty', 'Plot No. 1A, Bhat GIDC Estate, Gandhinagar', '+91 79 6670 1800', 23.1118, 72.6074, 'ahmedabad', 'Gujarat', 'Gandhinagar', '382428', 380, 27, 'Level 1 Trauma', 'Cardiac Emergency, Neurosurgery, Organ Transplants', 7.2, 'NABH Registry', '2026-08-19T08:00:00Z', 0.97],

      // 9. Pune (Maharashtra)
      ['HSP-PNE-01', 'Sassoon General Hospital & BJ Medical College', 'Government Apex Hospital', 'Station Road, Near Pune Railway Station, Pune', '+91 20 2612 8000', 18.5276, 73.8732, 'pune', 'Maharashtra', 'Pune', '411001', 520, 39, 'Level 1 Apex', 'Comprehensive Polytrauma, Burns Unit, Cardiac ICU, Toxicology', 5.3, 'Maharashtra Health Directorate', '2026-08-19T08:00:00Z', 0.98],
      ['HSP-PNE-02', 'Ruby Hall Clinic', 'Private Multi-Specialty', '40 Sassoon Road, Pune', '+91 20 6645 5100', 18.5302, 73.8767, 'pune', 'Maharashtra', 'Pune', '411001', 400, 31, 'Level 1 Trauma', 'Interventional Cardiology, Neuro Trauma, Intensive Critical Care', 5.7, 'NABH Registry', '2026-08-19T08:00:00Z', 0.98],

      // 10. Lucknow (Uttar Pradesh)
      ['HSP-LKO-01', "King George's Medical University (KGMU) Trauma Center", 'State Apex Trauma Center', 'Shah Mina Road, Chowk, Lucknow', '+91 522 225 7540', 26.8682, 80.9150, 'lucknow', 'Uttar Pradesh', 'Lucknow', '226003', 560, 44, 'Level 1 Apex', 'Comprehensive Polytrauma, Neurosurgery, Cardiac Arrest Center', 5.1, 'UP Health Systems', '2026-08-19T08:00:00Z', 0.99],
      ['HSP-LKO-02', 'Medanta Hospital Lucknow', 'Private Multi-Specialty', 'Sector A, Pocket 1, Sushant Golf City, Amar Shaheed Path, Lucknow', '+91 522 450 5050', 26.7904, 80.9845, 'lucknow', 'Uttar Pradesh', 'Lucknow', '226030', 450, 33, 'Level 1 Trauma', 'Emergency Resuscitation, Cardiac Surgery, Critical Care ICU', 7.4, 'NABH Registry', '2026-08-19T08:00:00Z', 0.98],

      // 11. Chandigarh (Punjab / Haryana / UT)
      ['HSP-IXC-01', 'PGIMER Apex Emergency & Trauma Center', 'National Apex Institute', 'Sector 12, Chandigarh', '+91 172 274 7585', 30.7635, 76.7766, 'chandigarh', 'Chandigarh', 'Chandigarh', '160012', 620, 49, 'Level 1 Apex', 'Polytrauma, Advanced Neurosurgery, ECMO, Organ Support', 4.7, 'MoHFW Central Registry', '2026-08-19T08:00:00Z', 1.0],

      // 12. Guwahati (Assam / North East)
      ['HSP-GAU-01', 'Gauhati Medical College & Hospital (GMCH)', 'State Apex Center', 'Narakasur Hilltop, Bhangagarh, Guwahati', '+91 361 252 9457', 26.1554, 91.7725, 'guwahati', 'Assam', 'Guwahati', '781032', 500, 38, 'Level 1 Apex', 'North East Regional Trauma Hub, Neurosurgery, Cardiac Emergency', 5.8, 'Assam State Health', '2026-08-19T08:00:00Z', 0.99],

      // 13. Kochi (Kerala)
      ['HSP-COK-01', 'Amrita Institute of Medical Sciences (AIMS)', 'Tertiary Multi-Specialty', 'AIMS Ponekkara, Kochi', '+91 484 285 1234', 10.0328, 76.2942, 'kochi', 'Kerala', 'Kochi', '682041', 520, 43, 'Level 1 Apex', 'Disaster Triage, Pediatric Trauma, Interventional Cardiology', 5.2, 'Kerala Health Registry', '2026-08-19T08:00:00Z', 0.99],

      // 14. Bhopal (Madhya Pradesh)
      ['HSP-BHO-01', 'AIIMS Bhopal Apex Emergency Center', 'National Apex Center', 'Saket Nagar, Bhopal', '+91 755 267 2355', 23.2084, 77.4589, 'bhopal', 'Madhya Pradesh', 'Bhopal', '462020', 480, 37, 'Level 1 Apex', 'Central India Regional Trauma, Toxicology, Resuscitation', 5.4, 'MoHFW Central Registry', '2026-08-19T08:00:00Z', 0.99],

      // 15. Patna (Bihar)
      ['HSP-PAT-01', 'AIIMS Patna Emergency Trauma Center', 'National Apex Center', 'Phulwari Sharif, Patna', '+91 612 245 1070', 25.5604, 85.0441, 'patna', 'Bihar', 'Patna', '801507', 460, 35, 'Level 1 Apex', 'Comprehensive Polytrauma, Stroke Intervention, Acute Care', 5.9, 'MoHFW Central Registry', '2026-08-19T08:00:00Z', 0.99],

      // 16. Bhubaneswar (Odisha)
      ['HSP-BBI-01', 'AIIMS Bhubaneswar Emergency Hub', 'National Apex Center', 'Sijua, Patrapada, Bhubaneswar', '+91 674 247 6789', 20.2312, 85.7766, 'bhubaneswar', 'Odisha', 'Bhubaneswar', '751019', 490, 41, 'Level 1 Apex', 'Cyclonic Disaster Response, Polytrauma, Neurosurgery', 5.3, 'MoHFW Central Registry', '2026-08-19T08:00:00Z', 0.99],

      // 17. Srinagar (Jammu & Kashmir)
      ['HSP-SXR-01', 'SKIMS (Sher-i-Kashmir Institute of Medical Sciences)', 'Autonomous Apex Center', 'Soura, Srinagar', '+91 194 240 1013', 34.1354, 74.8052, 'srinagar', 'Jammu & Kashmir', 'Srinagar', '190011', 450, 34, 'Level 1 Apex', 'High-Altitude Trauma, Frostbite & Hypothermia Resuscitation, Neuro ICU', 5.7, 'J&K Health Services', '2026-08-19T08:00:00Z', 0.99]
    ];

    for (const h of PAN_INDIA_HOSPITALS) {
      await run(`
        INSERT INTO hospitals (
          id, name, type, address, phone, latitude, longitude, region, state, city, pincode,
          capacity, available_beds, trauma_level, specialty, eta_minutes, data_source, last_updated, data_confidence
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, h);
    }
  }

  // Seed Pan-India Ambulance Fleet if count is low
  const ambulanceCount = await get('SELECT COUNT(*) AS count FROM ambulances');
  if ((ambulanceCount?.count || 0) < 15) {
    await run('DELETE FROM ambulances');

    const PAN_INDIA_AMBULANCES = [
      // Jaipur Fleet
      ['AMB-JPR-01', 'RJ14 AA 2211', 'ALS (Advanced Life Support)', 'available', 26.9150, 75.7800, 'jaipur', 'Jaipur', 94, 3, 4.2, '2026-08-19T08:15:00Z'],
      ['AMB-JPR-02', 'RJ14 AB 4432', 'BLS (Basic Life Support)', 'available', 26.8350, 75.7950, 'jaipur', 'Jaipur', 82, 2, 5.8, '2026-08-19T08:18:00Z'],
      ['AMB-JPR-03', 'RJ14 AC 5567', 'ALS (Mobile ICU)', 'dispatched', 26.9190, 75.7550, 'jaipur', 'Jaipur', 78, 3, 3.4, '2026-08-19T08:20:00Z'],
      ['AMB-JPR-04', 'RJ14 AD 7891', 'BLS (Basic Life Support)', 'available', 26.9380, 75.8150, 'jaipur', 'Jaipur', 89, 2, 5.0, '2026-08-19T08:25:00Z'],

      // Delhi Fleet
      ['AMB-DEL-01', 'DL01 EA 1100', 'ALS (Mobile ICU)', 'available', 28.5680, 77.2090, 'delhi', 'New Delhi', 96, 3, 3.8, '2026-08-19T08:12:00Z'],
      ['AMB-DEL-02', 'DL01 EB 3344', 'ALS (Cardiac Unit)', 'available', 28.5300, 77.2150, 'delhi', 'New Delhi', 88, 3, 4.5, '2026-08-19T08:15:00Z'],

      // Mumbai Fleet
      ['AMB-MUM-01', 'MH01 CA 9988', 'ALS (Cardiac Resuscitation)', 'available', 19.0040, 72.8410, 'mumbai', 'Mumbai', 91, 3, 4.0, '2026-08-19T08:10:00Z'],
      ['AMB-MUM-02', 'MH02 CB 4567', 'BLS (Basic Life Support)', 'available', 19.0530, 72.8310, 'mumbai', 'Mumbai', 85, 2, 5.2, '2026-08-19T08:14:00Z'],

      // Bengaluru Fleet
      ['AMB-BLR-01', 'KA01 MA 1008', 'ALS (Advanced Life Support)', 'available', 12.9600, 77.6480, 'bengaluru', 'Bengaluru', 93, 3, 4.1, '2026-08-19T08:20:00Z'],
      ['AMB-BLR-02', 'KA03 MB 5544', 'BLS (Basic Life Support)', 'available', 12.9650, 77.5780, 'bengaluru', 'Bengaluru', 87, 2, 4.9, '2026-08-19T08:22:00Z'],

      // Hyderabad Fleet
      ['AMB-HYD-01', 'TS09 HA 7711', 'ALS (Mobile ICU)', 'available', 17.4240, 78.4510, 'hyderabad', 'Hyderabad', 90, 3, 4.4, '2026-08-19T08:16:00Z'],

      // Chennai Fleet
      ['AMB-MAA-01', 'TN01 CA 6622', 'ALS (Advanced Life Support)', 'available', 13.0820, 80.2760, 'chennai', 'Chennai', 95, 3, 3.9, '2026-08-19T08:18:00Z'],

      // Kolkata Fleet
      ['AMB-CCU-01', 'WB02 KA 3311', 'ALS (Mobile ICU)', 'available', 22.5410, 88.3460, 'kolkata', 'Kolkata', 88, 3, 4.6, '2026-08-19T08:15:00Z'],

      // Ahmedabad Fleet
      ['AMB-AMD-01', 'GJ01 GA 4422', 'ALS (Advanced Life Support)', 'available', 23.0540, 72.5990, 'ahmedabad', 'Ahmedabad', 92, 3, 4.3, '2026-08-19T08:17:00Z'],

      // Pune Fleet
      ['AMB-PNE-01', 'MH12 PA 8822', 'ALS (Trauma Resuscitation)', 'available', 18.5290, 73.8740, 'pune', 'Pune', 89, 3, 4.5, '2026-08-19T08:19:00Z'],

      // Lucknow Fleet
      ['AMB-LKO-01', 'UP32 LA 1122', 'ALS (Mobile ICU)', 'available', 26.8690, 80.9160, 'lucknow', 'Lucknow', 94, 3, 4.1, '2026-08-19T08:12:00Z'],

      // Chandigarh Fleet
      ['AMB-IXC-01', 'CH01 GA 9900', 'ALS (Advanced Life Support)', 'available', 30.7640, 76.7780, 'chandigarh', 'Chandigarh', 96, 3, 3.7, '2026-08-19T08:10:00Z']
    ];

    for (const amb of PAN_INDIA_AMBULANCES) {
      await run(`
        INSERT INTO ambulances (id, vehicle_number, type, status, latitude, longitude, region, city, battery, crew_count, eta_minutes, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, amb);
    }
  }

  // Seed sample Incidents if empty
  const incidentCount = await get('SELECT COUNT(*) AS count FROM incidents');
  if ((incidentCount?.count || 0) === 0) {
    const defaultIncidents = [
      ['INC-1001', 'Multi-Vehicle Highway Collision', 'Trauma', 'critical', 'active', 'NH-48 Highway Junction', 26.9240, 75.7920, 'jaipur', 'Jaipur', 4, 4.8, '2026-08-19T08:00:00Z', '2026-08-19T08:03:00Z'],
      ['INC-1002', 'Acute STEMI / Cardiac Arrest', 'Cardiac', 'critical', 'dispatched', 'Connaught Place Ring Radial', 28.6315, 77.2167, 'delhi', 'New Delhi', 1, 3.5, '2026-08-19T08:10:00Z', '2026-08-19T08:12:00Z'],
      ['INC-1003', 'Severe Respiratory Failure', 'Pulmonary', 'high', 'en-route', 'Bandra Kurla Complex (BKC)', 19.0657, 72.8687, 'mumbai', 'Mumbai', 2, 6.2, '2026-08-19T08:06:00Z', '2026-08-19T08:08:00Z'],
      ['INC-1004', 'Fall from Height / Orthopedic Injury', 'Trauma', 'medium', 'active', 'Electronic City Phase 1', 12.8399, 77.6770, 'bengaluru', 'Bengaluru', 1, 8.5, '2026-08-19T08:22:00Z', '2026-08-19T08:23:00Z']
    ];

    for (const inc of defaultIncidents) {
      await run(`
        INSERT INTO incidents (id, title, type, severity, status, location, latitude, longitude, region, city, patient_count, eta_minutes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, inc);
    }
  }

  // Seed default audit log if empty
  const auditCount = await get('SELECT COUNT(*) AS count FROM audit_logs');
  if ((auditCount?.count || 0) === 0) {
    await run(`
      INSERT INTO audit_logs (id, actor, action, category, details, timestamp)
      VALUES
      ('LOG-100001', 'SYSTEM_BOOT', 'PLATFORM_INITIALIZATION', 'SYSTEM', 'GoldenHour India-Wide Emergency Dispatch Platform Initialized', '2026-08-19T07:55:00Z'),
      ('LOG-100002', 'DISPATCHER', 'DISPATCHED AMB-JPR-03 -> INC-1001', 'DISPATCH', 'Assigned SMS Super Specialty Trauma Hospital | ETA: 4.5m', '2026-08-19T08:03:00Z')
    `);
  }

  // Create High-Performance Indexes
  await run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
  await run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
  await run('CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)');
  await run('CREATE INDEX IF NOT EXISTS idx_incidents_region ON incidents(region)');
  await run('CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_ambulances_status ON ambulances(status)');
  await run('CREATE INDEX IF NOT EXISTS idx_ambulances_region ON ambulances(region)');
  await run('CREATE INDEX IF NOT EXISTS idx_hospitals_region ON hospitals(region)');
  await run('CREATE INDEX IF NOT EXISTS idx_hospitals_state ON hospitals(state)');
  await run('CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city)');
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
