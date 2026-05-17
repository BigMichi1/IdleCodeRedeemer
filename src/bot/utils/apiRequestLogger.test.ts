import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';

import { apiRequestLogger } from './apiRequestLogger';

// The module writes to <cwd>/api-logs. We clean that directory before/after
// each test to keep tests isolated and avoid polluting the workspace.
const API_LOGS_DIR = path.join(process.cwd(), 'api-logs');

function getLogFiles(): string[] {
  if (!fs.existsSync(API_LOGS_DIR)) return [];
  return fs.readdirSync(API_LOGS_DIR);
}

function cleanApiLogs(): void {
  if (!fs.existsSync(API_LOGS_DIR)) return;
  for (const file of fs.readdirSync(API_LOGS_DIR)) {
    fs.unlinkSync(path.join(API_LOGS_DIR, file));
  }
}

// ---------------------------------------------------------------------------
// log() — write behaviour
// ---------------------------------------------------------------------------
describe('log', () => {
  beforeEach(() => cleanApiLogs());
  afterEach(() => cleanApiLogs());

  test('writes a JSON file for a successful response', () => {
    apiRequestLogger.log(
      'user123',
      'redeemcoupon',
      { url: 'https://example.com/api?hash=abc123&user_id=99990000', method: 'GET' },
      { status: 200, ok: true, body: { success: true } }
    );
    const files = getLogFiles();
    expect(files).toHaveLength(1);
    const content = JSON.parse(fs.readFileSync(path.join(API_LOGS_DIR, files[0]!), 'utf-8'));
    expect(content.action).toBe('redeemcoupon');
    expect(content.response.status).toBe(200);
    expect(content.response.ok).toBe(true);
  });

  test('sanitizes hash and user_id from the URL', () => {
    apiRequestLogger.log(
      'user123',
      'getuserdetails',
      { url: 'https://play.idlechampions.com/api?hash=supersecret&user_id=12345678&code=MYCODE', method: 'GET' },
      { status: 200, ok: true }
    );
    const files = getLogFiles();
    const content = JSON.parse(fs.readFileSync(path.join(API_LOGS_DIR, files[0]!), 'utf-8'));
    expect(content.request.url).not.toContain('supersecret');
    expect(content.request.url).toContain('***');
    expect(content.request.url).not.toContain('MYCODE');
  });

  test('uses "system" as user prefix when userId is undefined', () => {
    apiRequestLogger.log(
      undefined,
      'ping',
      { url: 'https://example.com/ping', method: 'GET' },
      { status: 200, ok: true }
    );
    const files = getLogFiles();
    expect(files[0]).toMatch(/^system_ping_/);
  });

  test('truncates userId to 8 chars in the filename', () => {
    apiRequestLogger.log(
      'longUserId12345',
      'testaction',
      { url: 'https://example.com', method: 'GET' },
      { status: 500, ok: false, error: 'server error' }
    );
    const files = getLogFiles();
    expect(files[0]).toMatch(/^longUser_testaction_/);
  });

  test('stores the error field when provided', () => {
    apiRequestLogger.log(
      'user123',
      'failcall',
      { url: 'https://example.com/api', method: 'GET' },
      { status: 503, ok: false, error: 'Service unavailable' }
    );
    const files = getLogFiles();
    const content = JSON.parse(fs.readFileSync(path.join(API_LOGS_DIR, files[0]!), 'utf-8'));
    expect(content.response.error).toBe('Service unavailable');
    expect(content.response.ok).toBe(false);
  });

  test('includes request body when provided', () => {
    apiRequestLogger.log(
      'user123',
      'submitcode',
      { url: 'https://example.com/api', method: 'POST', body: { code: 'TESTCODE' } },
      { status: 200, ok: true }
    );
    const files = getLogFiles();
    const content = JSON.parse(fs.readFileSync(path.join(API_LOGS_DIR, files[0]!), 'utf-8'));
    expect(content.request.body).toEqual({ code: 'TESTCODE' });
  });

  test('sanitizes non-URL strings gracefully (returns raw string)', () => {
    apiRequestLogger.log(
      'user123',
      'rawurl',
      { url: 'not-a-valid-url', method: 'GET' },
      { status: 200, ok: true }
    );
    const files = getLogFiles();
    const content = JSON.parse(fs.readFileSync(path.join(API_LOGS_DIR, files[0]!), 'utf-8'));
    expect(content.request.url).toBe('not-a-valid-url');
  });
});

// ---------------------------------------------------------------------------
// getLogs() — directory listing
// ---------------------------------------------------------------------------
describe('getLogs', () => {
  beforeEach(() => {
    cleanApiLogs();
    if (!fs.existsSync(API_LOGS_DIR)) fs.mkdirSync(API_LOGS_DIR, { recursive: true });
    // Create two fake log files
    fs.writeFileSync(path.join(API_LOGS_DIR, 'abcdef12_redeemcoupon_2025-01-01T00-00-00-000Z.json'), '{}');
    fs.writeFileSync(path.join(API_LOGS_DIR, '99999999_getuserdetails_2025-01-02T00-00-00-000Z.json'), '{}');
  });
  afterEach(() => cleanApiLogs());

  test('returns all log files sorted most-recent first (descending by filename)', () => {
    const logs = apiRequestLogger.getLogs();
    expect(logs).toHaveLength(2);
    // localeCompare descending: 'abcdef12...' > '99999999...' (a > 9 in ASCII)
    expect(logs[0]!.filename).toBe('abcdef12_redeemcoupon_2025-01-01T00-00-00-000Z.json');
    expect(logs[1]!.filename).toBe('99999999_getuserdetails_2025-01-02T00-00-00-000Z.json');
  });

  test('filters by userId prefix (first 8 chars)', () => {
    const logs = apiRequestLogger.getLogs('abcdef12extra');
    expect(logs).toHaveLength(1);
    expect(logs[0]!.filename).toMatch(/^abcdef12/);
  });

  test('returns empty array when directory does not exist', () => {
    // Temporarily remove the dir
    fs.rmSync(API_LOGS_DIR, { recursive: true, force: true });
    const logs = apiRequestLogger.getLogs();
    expect(logs).toEqual([]);
  });

  test('each entry has filename and path properties', () => {
    const logs = apiRequestLogger.getLogs();
    expect(logs[0]).toHaveProperty('filename');
    expect(logs[0]).toHaveProperty('path');
  });
});

// ---------------------------------------------------------------------------
// getLogContent() — file reading and path traversal guard
// ---------------------------------------------------------------------------
describe('getLogContent', () => {
  beforeEach(() => {
    cleanApiLogs();
    if (!fs.existsSync(API_LOGS_DIR)) fs.mkdirSync(API_LOGS_DIR, { recursive: true });
  });
  afterEach(() => cleanApiLogs());

  test('returns null when the file does not exist', () => {
    expect(apiRequestLogger.getLogContent('nonexistent.json')).toBeNull();
  });

  test('returns parsed JSON content for a valid log file', () => {
    const filename = 'user1234_testaction_2025-01-01T00-00-00-000Z.json';
    const payload = { action: 'testaction', userId: 'user1234' };
    fs.writeFileSync(path.join(API_LOGS_DIR, filename), JSON.stringify(payload));
    const content = apiRequestLogger.getLogContent(filename);
    expect(content).toEqual(payload);
  });
});

// ---------------------------------------------------------------------------
// shutdown()
// ---------------------------------------------------------------------------
describe('shutdown', () => {
  test('can be called without throwing even when not initialized', () => {
    expect(() => apiRequestLogger.shutdown()).not.toThrow();
  });
});
