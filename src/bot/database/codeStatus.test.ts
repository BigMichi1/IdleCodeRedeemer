import { describe, test, expect } from 'bun:test';
import {
  CODE_STATUSES,
  CODE_STATUS_MAP,
  SETTLED_STATUSES,
  isCodeStatus,
  type CodeStatus,
} from './codeStatus';
import { CodeSubmitStatus } from '../api/idleChampionsApi';
import { normalizeCodeStatus } from './codeManager';

// ---------------------------------------------------------------------------
// The wire enum and the stored status strings were previously related only by
// position in a Record<number, string> declared far from both, with further
// copies in redeem.ts and the test suite. Nothing asserted the copies agreed,
// so adding a member to CodeSubmitStatus would shift every later value and
// silently reclassify statuses across six files with all tests still green.
// ---------------------------------------------------------------------------

describe('CODE_STATUS_MAP', () => {
  test('maps every CodeSubmitStatus member to a canonical stored status', () => {
    const wireValues = Object.values(CodeSubmitStatus).filter(
      (v): v is CodeSubmitStatus => typeof v === 'number'
    );

    for (const wire of wireValues) {
      const stored = CODE_STATUS_MAP[wire];
      expect(stored).toBeDefined();
      expect(CODE_STATUSES).toContain(stored);
    }
  });

  test('pins the wire-to-stored pairs', () => {
    expect(CODE_STATUS_MAP[CodeSubmitStatus.Success]).toBe('Success');
    expect(CODE_STATUS_MAP[CodeSubmitStatus.AlreadyRedeemed]).toBe('Already Redeemed');
    expect(CODE_STATUS_MAP[CodeSubmitStatus.InvalidParameters]).toBe('Invalid Parameters');
    expect(CODE_STATUS_MAP[CodeSubmitStatus.NotValidCombo]).toBe('Not a Valid Code');
    expect(CODE_STATUS_MAP[CodeSubmitStatus.Expired]).toBe('Code Expired');
    expect(CODE_STATUS_MAP[CodeSubmitStatus.CannotRedeem]).toBe('Cannot Redeem');
  });

  test('maps each wire status to a distinct stored status', () => {
    const stored = Object.values(CODE_STATUS_MAP);
    expect(new Set(stored).size).toBe(stored.length);
  });
});

describe('normalizeCodeStatus agrees with CODE_STATUS_MAP', () => {
  test('every wire value round-trips through normalizeCodeStatus', () => {
    for (const [wire, expected] of Object.entries(CODE_STATUS_MAP)) {
      expect(normalizeCodeStatus(Number(wire))).toBe(expected as CodeStatus);
      // The API has been seen to send the status as a numeric string.
      expect(normalizeCodeStatus(wire)).toBe(expected as CodeStatus);
    }
  });

  test('a canonical string passes through unchanged', () => {
    for (const status of CODE_STATUSES) {
      expect(normalizeCodeStatus(status)).toBe(status);
    }
  });
});

describe('SETTLED_STATUSES', () => {
  test('are all canonical statuses', () => {
    for (const status of SETTLED_STATUSES) {
      expect(isCodeStatus(status)).toBe(true);
    }
  });

  test('cover the outcomes that mean "this user is done with this code"', () => {
    expect(SETTLED_STATUSES).toContain('Success');
    expect(SETTLED_STATUSES).toContain('Already Redeemed');
    expect(SETTLED_STATUSES).toContain('Code Expired');
  });

  test('exclude retryable failures, so those codes are attempted again', () => {
    expect(SETTLED_STATUSES).not.toContain('Not a Valid Code');
    expect(SETTLED_STATUSES).not.toContain('Unknown Status');
  });
});

describe('isCodeStatus', () => {
  test('accepts every canonical status', () => {
    for (const status of CODE_STATUSES) {
      expect(isCodeStatus(status)).toBe(true);
    }
  });

  test('rejects near-misses that would silently match no rows', () => {
    expect(isCodeStatus('sucess')).toBe(false);
    expect(isCodeStatus('success')).toBe(false); // wrong case
    expect(isCodeStatus('')).toBe(false);
  });
});
