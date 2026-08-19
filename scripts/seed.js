const { initializeDatabase, get } = require('../src/database');

async function main() {
  console.log('Initializing and seeding Pan-India GoldenHour EDS database...');
  await initializeDatabase();

  const userCount = await get('SELECT COUNT(*) AS count FROM users');
  const incidentCount = await get('SELECT COUNT(*) AS count FROM incidents');
  const ambulanceCount = await get('SELECT COUNT(*) AS count FROM ambulances');
  const hospitalCount = await get('SELECT COUNT(*) AS count FROM hospitals');

  console.log('Seed summary:', {
    users: userCount?.count || 0,
    incidents: incidentCount?.count || 0,
    ambulances: ambulanceCount?.count || 0,
    hospitals: hospitalCount?.count || 0
  });
  console.log('Pan-India dataset successfully primed.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
