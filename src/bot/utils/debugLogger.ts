import * as fs from 'fs';
import * as path from 'path';

const DEBUG_DIR = path.join(process.cwd(), 'debug');
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const MAX_AGE = 60 * 60 * 1000; // 1 hour

// Initialize debug directory and cleanup on startup
function initDebugLogger() {
  if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    console.log(`[DEBUG] Created debug directory: ${DEBUG_DIR}`);
  }

  // Run cleanup immediately on startup
  cleanupOldFiles();

  // Schedule cleanup every hour
  setInterval(cleanupOldFiles, CLEANUP_INTERVAL);
}

function cleanupOldFiles() {
  try {
    const now = Date.now();
    const files = fs.readdirSync(DEBUG_DIR);

    for (const file of files) {
      const filePath = path.join(DEBUG_DIR, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > MAX_AGE) {
        fs.unlinkSync(filePath);
        console.log(`[DEBUG] Cleaned up old file: ${file}`);
      }
    }
  } catch (error) {
    console.error('[DEBUG] Error during cleanup:', error);
  }
}

function saveResponse(endpoint: string, response: any): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${endpoint}_${timestamp}.json`;
  const filePath = path.join(DEBUG_DIR, filename);

  try {
    fs.writeFileSync(filePath, JSON.stringify(response, null, 2));
    return filename;
  } catch (error) {
    console.error('[DEBUG] Error saving response:', error);
    return '';
  }
}

export { initDebugLogger, saveResponse };
