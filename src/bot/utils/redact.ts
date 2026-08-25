/**
 * Credential redaction shared by the command logger (write time) and the /logs
 * command (read time).
 *
 * Write-time redaction in bot.ts is the real defence: once a secret reaches
 * logs/combined.log or container stdout it is out, and filtering it on display
 * only hides it from Discord. The read-time pattern here remains as a safety net
 * for log lines written before this was fixed.
 */

/** Slash-command option names whose values must never be logged. */
const SENSITIVE_OPTION_NAMES = ['user_id', 'user_hash', 'hash', 'token', 'password', 'secret'];

export function isSensitiveOption(optionName: string): boolean {
  return SENSITIVE_OPTION_NAMES.includes(optionName.toLowerCase());
}

/**
 * Best-effort redaction of credential-shaped text in an existing log line.
 * Covers both `key=value` (emitted by the command logger) and the
 * `key: 'value'` / `"key":"value"` shapes an object dump would produce.
 */
const KEY = '(user_id|user_hash|hash|token|password|secret|userId|userHash)';
const PATTERNS: RegExp[] = [
  new RegExp(`\\b${KEY}=\\S+`, 'gi'),
  new RegExp(`(["']?)${KEY}\\1\\s*:\\s*(["'])[^"']*\\3`, 'gi'),
];

export function redactSensitive(line: string): string {
  let out = line;
  out = out.replace(PATTERNS[0]!, (_m, key: string) => `${key}=[REDACTED]`);
  out = out.replace(PATTERNS[1]!, (_m, q: string, key: string) => `${q}${key}${q}: '[REDACTED]'`);
  return out;
}
