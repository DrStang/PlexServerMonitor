const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'plex-monitor' },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Add console output in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
} else {
  // In production, use simple console format
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

module.exports = logger;
