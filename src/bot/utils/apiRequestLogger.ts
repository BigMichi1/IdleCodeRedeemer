import fs from 'fs';
import path from 'path';
import logger from './logger';

const API_LOGS_DIR = path.join(process.cwd(), 'api-logs');
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const FILE_RETENTION_MS = 24 * 60 * 60 * 1000; // 1 day (24 hours)

class ApiRequestLogger {
  private cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize the API request logger and start cleanup interval
   */
  public initialize(): void {
    // Ensure directory exists
    if (!fs.existsSync(API_LOGS_DIR)) {
      fs.mkdirSync(API_LOGS_DIR, { recursive: true });
      logger.debug('Created api-logs directory');
    }

    // Run cleanup immediately
    this.cleanup();

    // Schedule cleanup every hour
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL);

    logger.debug('API request logger initialized');
  }

  /**
   * Log an API request and response
   * @param userId User ID (optional, for identifying logs)
   * @param action API call name (e.g., 'redeemcoupon', 'getuserdetails')
   * @param request Request details (URL, method, etc.)
   * @param response Response details (status, body, etc.)
   */
  public log(
    userId: string | undefined,
    action: string,
    request: { url: string; method: string; body?: Record<string, any> },
    response: { status: number; ok: boolean; body?: any; error?: string },
  ): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const userPart = userId ? userId.substring(0, 8) : 'system';
      const filename = `${userPart}_${action}_${timestamp}.json`;
      const filepath = path.join(API_LOGS_DIR, filename);

      const logData = {
        timestamp: new Date().toISOString(),
        userId,
        action,
        request: {
          url: this.sanitizeUrl(request.url),
          method: request.method,
          body: request.body,
        },
        response: {
          status: response.status,
          ok: response.ok,
          body: response.body,
          error: response.error,
        },
      };

      fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
      logger.debug(`API request logged: ${filename}`);
    } catch (error) {
      logger.error('Error logging API request:', error);
    }
  }

  /**
   * Sanitize URL to remove sensitive parameters
   */
  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;

      // Mask sensitive parameters
      if (params.has('hash')) {
        params.set('hash', '***');
      }
      if (params.has('user_id')) {
        const userId = params.get('user_id');
        params.set('user_id', userId ? userId.substring(0, 4) + '***' : '***');
      }
      if (params.has('code')) {
        params.set('code', '***');
      }

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Clean up log files older than 1 day
   */
  private cleanup(): void {
    try {
      if (!fs.existsSync(API_LOGS_DIR)) {
        return;
      }

      const files = fs.readdirSync(API_LOGS_DIR);
      const now = Date.now();
      let deletedCount = 0;

      files.forEach((file) => {
        const filepath = path.join(API_LOGS_DIR, file);
        const stats = fs.statSync(filepath);
        const age = now - stats.mtimeMs;

        // Delete if older than 1 day
        if (age > FILE_RETENTION_MS) {
          try {
            fs.unlinkSync(filepath);
            deletedCount++;
          } catch (error) {
            logger.error(`Failed to delete old API log file ${file}:`, error);
          }
        }
      });

      if (deletedCount > 0) {
        logger.debug(`Cleaned up ${deletedCount} API log files older than 1 day`);
      }
    } catch (error) {
      logger.error('Error during API log cleanup:', error);
    }
  }

  /**
   * Stop the cleanup interval
   */
  public shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      logger.debug('API request logger cleanup stopped');
    }
  }

  /**
   * Get all log files (for inspection/debugging)
   */
  public getLogs(userId?: string): { filename: string; path: string }[] {
    try {
      if (!fs.existsSync(API_LOGS_DIR)) {
        return [];
      }

      const files = fs.readdirSync(API_LOGS_DIR);
      return files
        .filter((file) => {
          if (userId) {
            return file.startsWith(userId.substring(0, 8));
          }
          return true;
        })
        .map((file) => ({
          filename: file,
          path: path.join(API_LOGS_DIR, file),
        }))
        .sort((a, b) => b.filename.localeCompare(a.filename)); // Most recent first
    } catch (error) {
      logger.error('Error getting API logs:', error);
      return [];
    }
  }

  /**
   * Get a specific log file content
   */
  public getLogContent(filename: string): Record<string, any> | null {
    try {
      const filepath = path.join(API_LOGS_DIR, filename);

      // Security: prevent directory traversal
      if (!filepath.startsWith(API_LOGS_DIR)) {
        logger.warn('Attempted directory traversal in getLogContent');
        return null;
      }

      if (!fs.existsSync(filepath)) {
        return null;
      }

      const content = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error('Error reading API log file:', error);
      return null;
    }
  }
}

export const apiRequestLogger = new ApiRequestLogger();
