require('dotenv').config();

const config = {
  appName: process.env.APP_NAME || 'GoldenHour EDS',
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'goldenhour-demo-secret',
  dbPath: process.env.DB_PATH || './data/goldenhour.db',
  map: {
    centerLat: Number(process.env.MAP_CENTER_LAT || 26.9124),
    centerLng: Number(process.env.MAP_CENTER_LNG || 75.7873)
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  featureFlags: {
    aiRouting: true,
    mapLiveTracking: true,
    hospitalPanel: true,
    commandCenter: true,
    darkMode: true,
    roleSwitching: true,
    notifications: true,
    exports: true
  },
  roles: [
    { key: 'dispatcher', label: 'Dispatcher', permissions: ['read', 'create_incident', 'dispatch'] },
    { key: 'admin', label: 'Admin', permissions: ['read', 'manage_users', 'configure'] },
    { key: 'hospital', label: 'Hospital', permissions: ['read', 'hospital_updates'] }
  ]
};

module.exports = config;
