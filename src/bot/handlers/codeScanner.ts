import { Message } from 'discord.js';
import { codeManager } from '../database/codeManager';

const CODE_REGEX = /(?:[A-Z0-9*!@#$%^&*]-?){12}(?:(?:[A-Z0-9*!@#$%^&*]-?){4})?/g;

export async function scanMessageForCodes(message: Message): Promise<string[]> {
  try {
    // Skip bot messages and messages from the bot itself
    if (message.author.bot || message.webhookId) {
      return [];
    }

    // Extract text content (skip embeds for now, focus on message content)
    const messageText = message.content.toUpperCase();

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
  const codeMatches = text.toUpperCase().match(CODE_REGEX) || [];
  return codeMatches.map(code => code.replaceAll('-', ''));
}
