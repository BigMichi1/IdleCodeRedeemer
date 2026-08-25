import { describe, test, expect } from 'bun:test';
import { isSensitiveOption, redactSensitive } from './redact';

// ---------------------------------------------------------------------------
// /setup's options are the user's Idle Champions credentials. Logging their
// values put the plaintext in logs/combined.log and container stdout, next to
// the AES-encrypted copy in the database. Redaction happens at write time now;
// these tests pin that the option names are recognised.
// ---------------------------------------------------------------------------

describe('isSensitiveOption', () => {
  test("recognises /setup's credential options", () => {
    expect(isSensitiveOption('user_id')).toBe(true);
    expect(isSensitiveOption('user_hash')).toBe(true);
  });

  test('recognises other secret-bearing option names', () => {
    expect(isSensitiveOption('hash')).toBe(true);
    expect(isSensitiveOption('token')).toBe(true);
    expect(isSensitiveOption('password')).toBe(true);
    expect(isSensitiveOption('secret')).toBe(true);
  });

  test('is case-insensitive', () => {
    expect(isSensitiveOption('USER_HASH')).toBe(true);
    expect(isSensitiveOption('User_Id')).toBe(true);
  });

  test('leaves ordinary options alone', () => {
    expect(isSensitiveOption('code')).toBe(false);
    expect(isSensitiveOption('count')).toBe(false);
    expect(isSensitiveOption('channel')).toBe(false);
  });
});

describe('redactSensitive', () => {
  test('redacts the key=value shape written by the command logger', () => {
    const line = '[COMMAND] setup user_id=12345 user_hash=abcdefSECRET from user#1234';
    const out = redactSensitive(line);
    expect(out).not.toContain('abcdefSECRET');
    expect(out).not.toContain('12345');
    expect(out).toContain('[REDACTED]');
  });

  test('redacts object-literal shapes the old pattern missed', () => {
    // The previous regex only matched key=value, so an object dump such as
    // `{ userId: '1', userHash: 'SECRET' }` passed through unredacted.
    const out = redactSensitive("[SETUP] creds: { userId: '12345', userHash: 'SUPERSECRET' }");
    expect(out).not.toContain('SUPERSECRET');
    expect(out).toContain('[REDACTED]');
  });

  test('redacts JSON shapes', () => {
    const out = redactSensitive('{"user_hash":"SUPERSECRET","code":"ABCD1234EFGH"}');
    expect(out).not.toContain('SUPERSECRET');
    expect(out).toContain('ABCD1234EFGH');
  });

  test('leaves non-sensitive lines untouched', () => {
    const line = '[COMMAND] redeem count=5 from user#1234';
    expect(redactSensitive(line)).toBe(line);
  });
});
