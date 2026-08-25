import { describe, test, expect } from 'bun:test';
import { parseSqliteTimestamp } from './sqliteTime';

// ---------------------------------------------------------------------------
// SQLite CURRENT_TIMESTAMP is UTC with no zone marker. `new Date(that)` reads it
// as local time, which inflated every elapsed-time calculation by the host's UTC
// offset -- letting the /backfill rate limit and the 6-hour startup-backfill
// guard be bypassed at positive offsets, and shifting the dates shown by /codes.
// ---------------------------------------------------------------------------

describe('parseSqliteTimestamp', () => {
  test('parses a SQLite timestamp as UTC regardless of host time zone', () => {
    expect(parseSqliteTimestamp('2026-08-25 07:45:02')).toBe(
      Date.UTC(2026, 7, 25, 7, 45, 2)
    );
  });

  test('does not drift with the local offset the way new Date() does', () => {
    const raw = '2026-08-25 07:45:02';
    const parsed = parseSqliteTimestamp(raw);
    const offsetMs = new Date(parsed).getTimezoneOffset() * 60_000;

    // When the host is not at UTC, the naive parse is wrong by exactly the offset.
    if (offsetMs !== 0) {
      expect(new Date(raw).getTime()).not.toBe(parsed);
    }
    expect(new Date(parsed).toISOString()).toBe('2026-08-25T07:45:02.000Z');
  });

  test('an elapsed-time check is not skewed into the past', () => {
    // Regression: a backfill that just finished must not look like it finished
    // hours ago, which is what let the cooldown be bypassed.
    const nowSqlite = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const elapsed = Date.now() - parseSqliteTimestamp(nowSqlite);
    expect(elapsed).toBeGreaterThanOrEqual(-1000);
    expect(elapsed).toBeLessThan(60_000);
  });

  test('passes through ISO-8601 input that already carries a zone', () => {
    expect(parseSqliteTimestamp('2026-08-25T07:45:02Z')).toBe(Date.UTC(2026, 7, 25, 7, 45, 2));
    expect(parseSqliteTimestamp('2026-08-25T09:45:02+02:00')).toBe(
      Date.UTC(2026, 7, 25, 7, 45, 2)
    );
  });

  test('returns NaN for unparseable input so callers can fall back', () => {
    expect(Number.isNaN(parseSqliteTimestamp('not a timestamp'))).toBe(true);
  });
});
