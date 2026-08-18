const { initializeDatabase, run, all } = require('../src/database');

async function main() {
  await initializeDatabase();

  const users = [
    { username: 'dispatcher', role: 'dispatcher', name: 'Dispatcher Ops', password: 'goldenhour@123' },
    { username: 'admin', role: 'admin', name: 'Admin Lead', password: 'admin@golden' },
    { username: 'hospital', role: 'hospital', name: 'Hospital Liaison', password: 'hospital@2026' },
    { username: 'citizen', role: 'citizen', name: 'Citizen Portal', password: 'citizen@123' },
    { username: 'ambulance', role: 'ambulance', name: 'Ambulance Fleet', password: 'ambulance@123' },
    { username: 'superadmin', role: 'super_admin', name: 'Super Admin', password: 'superadmin@123' }
  ];

  console.log('Seeded demo users:', users.map((u) => u.username).join(', '));
  const incidents = await all('SELECT COUNT(*) AS count FROM incidents');
  const ambulances = await all('SELECT COUNT(*) AS count FROM ambulances');
  const hospitals = await all('SELECT COUNT(*) AS count FROM hospitals');
  console.log('Seed summary:', { incidents: incidents[0].count, ambulances: ambulances[0].count, hospitals: hospitals[0].count });
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
