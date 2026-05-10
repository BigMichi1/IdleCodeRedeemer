import { Message } from 'discord.js';
import { codeManager } from '../database/codeManager';

// Aligned with the Idle Champions Chrome extension regex
const CODE_REGEX = /(?:[A-Z0-9*!@#$%^&*]-?){12}(?:(?:[A-Z0-9*!@#$%^&*]-?){4})?/g;

// Strip Discord custom emoji tags (<:name:id> and <a:name:id>) before scanning
// to avoid false positives from emoji names and snowflake IDs.
function stripDiscordEmojis(text: string): string {
  return text.replace(/<a?:[^:]+:\d+>/g, '');
}

export async function scanMessageForCodes(message: Message): Promise<string[]> {
  try {

    // Strip emoji tags then uppercase for matching
    const messageText = stripDiscordEmojis(message.content).toUpperCase();

    const codeMatches = messageText.match(CODE_REGEX) || [];
    const codes: string[] = [];

    for (const match of codeMatches) {
      // Remove dashes from the code
      const cleanCode = match.replaceAll('-', '');

      // Verify it hasn't already been redeemed
      const isRedeemed = await codeManager.isCodeRedeemed(cleanCode);

      if (!isRedeemed) {
        codes.push(cleanCode);
        console.log(`[CODE SCANNER] Found new code: ${cleanCode}`);
      }
    }

    return codes;
  } catch (error) {
    console.error('[CODE SCANNER] Error scanning message:', error);
    return [];
  }
}

export function extractCodesFromText(text: string): string[] {
  const codeMatches = stripDiscordEmojis(text).toUpperCase().match(CODE_REGEX) || [];
  return codeMatches.map((code) => code.replaceAll('-', ''));
}
