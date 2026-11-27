import { Message } from 'discord.js';
import { codeManager } from '../database/codeManager';
import logger from '../utils/logger';

// Aligned with the Idle Champions Chrome extension regex, plus lookarounds the
// extension does not need because it only runs on a known page. They anchor the
// match so a code cannot be a fragment of a longer alphanumeric run.
//
// Without anchoring, the character class combined with the .toUpperCase() below
// matched any 12+ letter English word -- "Congratulations" -> "CONGRATULATI",
// "recommendation" -> "RECOMMENDATI". Anchoring alone still admits words of
// exactly 12 or 16 letters, which looksLikeCode() below rejects.
//
// Each false positive costs one live redeemcoupon call against every registered
// user's game account, so the filter errs toward rejecting.
const CODE_REGEX =
  /(?<![A-Z0-9])(?:[A-Z0-9*!@#$%^&]-?){12}(?:(?:[A-Z0-9*!@#$%^&]-?){4})?(?![A-Z0-9])/g;

/**
 * Distinguish a real promo code from an English word of the same length.
 *
 * Real codes take one of two observed shapes: dash-grouped blocks of four
 * ("LATU-EGIS-TOCK", which contains no digits at all), or an undashed run that
 * mixes letters and digits ("ABCD1234EFGH"). An English word is neither.
 *
 * `raw` is the match before separators are stripped, so the dash test can still
 * see them.
 */
function looksLikeCode(raw: string, cleaned: string): boolean {
  return raw.includes('-') || /[0-9]/.test(cleaned);
}

/**
 * The undashed, digit-free code that heads a #combinations feed post, or null.
 *
 * The feed usually posts dash-grouped codes, but it has also posted plain
 * letters ("SOSOSOUPBEAT"), which looksLikeCode() cannot tell from an English
 * word. Such a code is accepted only in the feed's exact shape: alone on the
 * first line, uppercase in the original text (before the pipeline uppercases
 * it), in a message that also carries the feed's "Expires" line. Prose fails at
 * least one of those, so the filter still errs toward rejecting.
 */
function feedHeadCode(text: string): string | null {
  const firstLine = (text.split('\n', 1)[0] ?? '').trim();
  if (!/^[A-Z]{12}(?:[A-Z]{4})?$/.test(firstLine)) return null;
  return /^\s*Expires\b/m.test(text) ? firstLine : null;
}

/** Shared match pipeline: strip noise, uppercase, match, drop separators. */
function matchCodes(text: string): string[] {
  const headCode = feedHeadCode(text);
  const matches = stripUrls(stripDiscordEmojis(text)).toUpperCase().match(CODE_REGEX) || [];
  return matches
    .map((raw) => ({ raw, cleaned: raw.replaceAll('-', '') }))
    .filter(({ raw, cleaned }) => looksLikeCode(raw, cleaned) || cleaned === headCode)
    .map(({ cleaned }) => cleaned);
}

// Strip Discord custom emoji tags (<:name:id> and <a:name:id>) before scanning
// to avoid false positives from emoji names and snowflake IDs.
function stripDiscordEmojis(text: string): string {
  return text.replace(/<a?:[^:]+:\d+>/g, '');
}

// Strip URLs before scanning to avoid false positives from URL paths/usernames.
function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, '');
}

export async function scanMessageForCodes(message: Message): Promise<string[]> {
  // Deliberately no try/catch: the only throwing call here is a synchronous
  // SQLite read, and returning [] on failure is indistinguishable from "this
  // message contained no codes" -- which silently drops a real code for every
  // user, permanently. Let it propagate to the handler in bot.ts.
  const codes: string[] = [];

  for (const cleanCode of matchCodes(message.content)) {
    const isRedeemed = await codeManager.isCodeRedeemed(cleanCode);

    if (!isRedeemed) {
      codes.push(cleanCode);
      logger.info(`[CODE SCANNER] Found new code: ${cleanCode}`);
    }
  }

  return codes;
}

export function extractCodesFromText(text: string): string[] {
  return matchCodes(text);
}
