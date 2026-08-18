const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function now() {
  return new Date().toISOString();
}

function write(level, message, meta = {}) {
  const payload = {
    timestamp: now(),
    level,
    message,
    ...meta
  };

  const line = `${JSON.stringify(payload)}\n`;
  fs.appendFileSync(path.join(logDir, 'app.log'), line, { flag: 'a' });
  console.log(line.trim());
}

module.exports = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  debug: (message, meta) => write('debug', message, meta)
};
