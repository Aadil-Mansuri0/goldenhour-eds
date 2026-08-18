const { initializeDatabase } = require('../src/database');

async function main() {
  await initializeDatabase();
  console.log('Database schema ready.');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
