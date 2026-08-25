import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists (recursive: true is a no-op when it already does)
const logsDir = path.join(process.cwd(), 'logs');
fs.mkdirSync(logsDir, { recursive: true });

// Define log levels with colors
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    trace: 'gray',
  },
};

// Create logger instance
const logger = winston.createLogger({
  levels: customLevels.levels,
  // debug/trace sit below info in the custom level set above, so they are
  // suppressed unless LOG_LEVEL raises the threshold. This is read from the
  // environment because the docs advertise LOG_LEVEL=debug as the way to
  // diagnose a failing redemption -- previously every logger.debug() call in
  // the codebase was dead.
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'idle-bot' },
  transports: [
    // Error logs - only errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
        })
      ),
    }),

    // Combined logs - all levels
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 20,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
        })
      ),
    }),

    // Console output (development)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ colors: customLevels.colors }),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}]: ${message}`;
        })
      ),
    }),
  ],
});

// Add winston colors to console
winston.addColors(customLevels.colors);

export default logger;
