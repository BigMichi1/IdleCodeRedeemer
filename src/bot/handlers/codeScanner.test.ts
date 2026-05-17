import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { extractCodesFromText, scanMessageForCodes } from './codeScanner';
import { db, initializeDatabase } from '../database/db';
import { redeemedCodes, pendingCodes, users } from '../database/schema/index';
import { codeManager } from '../database/codeManager';
import type { Message } from 'discord.js';

describe('extractCodesFromText', () => {
  describe('12-character codes', () => {
    test('matches a plain 12-char alphanumeric code', () => {
      expect(extractCodesFromText('ABCD1234EFGH')).toEqual(['ABCD1234EFGH']);
    });

    test('matches a 12-char code with dashes and strips them', () => {
      expect(extractCodesFromText('ABCD-1234-EFGH')).toEqual(['ABCD1234EFGH']);
    });
  });

  describe('16-character codes', () => {
    test('matches a plain 16-char code', () => {
      expect(extractCodesFromText('ABCD1234EFGH5678')).toEqual(['ABCD1234EFGH5678']);
    });

    test('matches a 16-char code with dashes and strips them', () => {
      expect(extractCodesFromText('ABCD-1234-EFGH-5678')).toEqual(['ABCD1234EFGH5678']);
    });
  });

  describe('case normalisation', () => {
    test('lowercased input is uppercased before matching', () => {
      expect(extractCodesFromText('abcd1234efgh')).toEqual(['ABCD1234EFGH']);
    });

    test('mixed-case input is normalised', () => {
      expect(extractCodesFromText('AbCd1234eFgH')).toEqual(['ABCD1234EFGH']);
    });
  });

  describe('URL stripping', () => {
    test('does not extract Twitch username as code', () => {
      const text = 'LATU-EGIS-TOCK\n\nhttps://www.twitch.tv/dungeonscrawlers\n1x Electrum Chest';
      expect(extractCodesFromText(text)).toEqual(['LATUEGISTOCK']);
    });

    test('does not extract long URL path segments as codes', () => {
      const text = 'GOEL-ARNA-VIDS\nhttps://www.twitch.tv/jasoncharlesmiller\n1x Electrum Chest';
      expect(extractCodesFromText(text)).toEqual(['GOELARNAVIDS']);
    });

    test('strips http URLs as well as https', () => {
      const text = 'ABCD1234EFGH http://example.com/SOMETHINGLONG123456';
      expect(extractCodesFromText(text)).toEqual(['ABCD1234EFGH']);
    });
  });

  describe('Discord emoji stripping', () => {
    test('strips static emoji tags before matching', () => {
      const text = 'Redeem <:gem:123456789012345678> this: ABCD1234EFGH';
      expect(extractCodesFromText(text)).toEqual(['ABCD1234EFGH']);
    });

    test('strips animated emoji tags before matching', () => {
      const text = '<a:spin:123456789012345678> ABCD1234EFGH';
      expect(extractCodesFromText(text)).toEqual(['ABCD1234EFGH']);
    });
  });

  describe('edge cases', () => {
    test('returns empty array for empty string', () => {
      expect(extractCodesFromText('')).toEqual([]);
    });

    test('returns empty array when no code present', () => {
      expect(extractCodesFromText('Hello, welcome to Idle Champions!')).toEqual([]);
    });

    test('returns multiple codes from one text', () => {
      const result = extractCodesFromText('Code1: ABCD1234EFGH Code2: WXYZ5678IJKL');
      expect(result).toHaveLength(2);
      expect(result).toContain('ABCD1234EFGH');
      expect(result).toContain('WXYZ5678IJKL');
    });

    test('strings shorter than 12 characters are not matched', () => {
      expect(extractCodesFromText('ABCD1234')).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// scanMessageForCodes — integration tests (uses DB)
// ---------------------------------------------------------------------------

const USER = 'discord-scanner-user';

/** Build a minimal Discord Message-like object with just a content string. */
function fakeMessage(content: string): Message {
  return { content } as unknown as Message;
}

beforeAll(() => {
  initializeDatabase();
});

beforeEach(() => {
  db.delete(pendingCodes).run();
  db.delete(redeemedCodes).run();
  db.delete(users).run();
});

describe('scanMessageForCodes', () => {
  test('returns new codes not yet in the database', async () => {
    const codes = await scanMessageForCodes(fakeMessage('ABCD1234EFGH'));
    expect(codes).toEqual(['ABCD1234EFGH']);
  });

  test('returns empty array when the code is already redeemed', async () => {
    db.insert(users).values({ discordId: USER, userId: '111', userHash: 'hash' }).run();
    await codeManager.addRedeemedCode('ABCD1234EFGH', USER, 'Success');
    const codes = await scanMessageForCodes(fakeMessage('ABCD1234EFGH'));
    expect(codes).toEqual([]);
  });

  test('returns empty array for a message with no codes', async () => {
    const codes = await scanMessageForCodes(fakeMessage('Hello world!'));
    expect(codes).toEqual([]);
  });

  test('returns multiple new codes from one message', async () => {
    const codes = await scanMessageForCodes(fakeMessage('Code 1: ABCD1234EFGH Code 2: WXYZ5678IJKL'));
    expect(codes).toHaveLength(2);
    expect(codes).toContain('ABCD1234EFGH');
    expect(codes).toContain('WXYZ5678IJKL');
  });

  test('filters out already-redeemed codes while returning new ones', async () => {
    db.insert(users).values({ discordId: USER, userId: '111', userHash: 'hash' }).run();
    await codeManager.addRedeemedCode('ABCD1234EFGH', USER, 'Success');
    const codes = await scanMessageForCodes(fakeMessage('ABCD1234EFGH WXYZ5678IJKL'));
    expect(codes).toEqual(['WXYZ5678IJKL']);
  });

  test('returns empty array on empty message', async () => {
    expect(await scanMessageForCodes(fakeMessage(''))).toEqual([]);
  });
});

