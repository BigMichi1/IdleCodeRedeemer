/**
 * SQLite's CURRENT_TIMESTAMP produces "YYYY-MM-DD HH:MM:SS" in UTC with no zone
 * marker. `new Date(that)` parses it as *local* time, so every elapsed-time
 * calculation was skewed by the host's UTC offset -- inflating it at positive
 * offsets, which let the /backfill rate limit and the 6-hour startup-backfill
 * guard be bypassed, and shifting every date shown by /codes.
 */
export function parseSqliteTimestamp(timestamp: string): number {
  // Already ISO-8601 with a zone (or an offset)? Let Date handle it.
  if (timestamp.includes('T') || /[Zz]$|[+-]\d{2}:?\d{2}$/.test(timestamp)) {
    return new Date(timestamp).getTime();
  }
  return new Date(`${timestamp.replace(' ', 'T')}Z`).getTime();
}
