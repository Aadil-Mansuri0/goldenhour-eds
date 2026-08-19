const logger = require('../logger');

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Route not found.'
  });
}

function errorHandler(err, req, res, _next) {
  logger.error('Unhandled application error', {
    stack: err?.stack,
    message: err?.message,
    path: req?.originalUrl
  });

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Internal server error.' : err.message
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
