import { describe, test, expect } from 'bun:test';
import { classifyFailureReason, CodeSubmitStatus, ResponseStatus } from './idleChampionsApi';

// ---------------------------------------------------------------------------
// classifyFailureReason()
//
// Regression cover for the ordered substring cascade this replaced, in which
// `includes('invalid')` shadowed the later `includes('parameter')` test and
// 'can_not_redeem_combination' never matched `includes('cannot')` -- making
// InvalidParameters and CannotRedeem unreachable, so a credentials problem was
// reported to the user as "Not a Valid Code".
// ---------------------------------------------------------------------------

describe('classifyFailureReason', () => {
  describe('wire values from api/types/redeem_code_response.d.ts', () => {
    const cases: [string, 'code' | 'generic', number][] = [
      ['Outdated instance id', 'generic', ResponseStatus.OutdatedInstanceId],
      ['you_already_redeemed_combination', 'code', CodeSubmitStatus.AlreadyRedeemed],
      ['someone_already_redeemed_combination', 'code', CodeSubmitStatus.AlreadyRedeemed],
      ['Invalid or incomplete parameters', 'code', CodeSubmitStatus.InvalidParameters],
      ['not_valid_combination', 'code', CodeSubmitStatus.NotValidCombo],
      ['offer_has_expired', 'code', CodeSubmitStatus.Expired],
      ['Not enough currency', 'generic', ResponseStatus.InsuficcientCurrency],
      ['can_not_redeem_combination', 'code', CodeSubmitStatus.CannotRedeem],
    ];

    for (const [reason, kind, status] of cases) {
      test(`"${reason}" -> ${kind}:${status}`, () => {
        const outcome = classifyFailureReason(reason);
        expect(outcome).toBeDefined();
        expect(outcome!.kind).toBe(kind);
        expect(outcome!.status).toBe(status);
      });
    }
  });

  describe('wire values from the former module-local enum', () => {
    const cases: [string, 'code' | 'generic', number][] = [
      ['already_redeemed', 'code', CodeSubmitStatus.AlreadyRedeemed],
      ['someone_already_redeemed', 'code', CodeSubmitStatus.AlreadyRedeemed],
      ['expired', 'code', CodeSubmitStatus.Expired],
      ['invalid_code_combo', 'code', CodeSubmitStatus.NotValidCombo],
      ['outdated_instance_id', 'generic', ResponseStatus.OutdatedInstanceId],
      ['invalid_parameters', 'code', CodeSubmitStatus.InvalidParameters],
      ['cannot_redeem', 'code', CodeSubmitStatus.CannotRedeem],
      ['insufficient_currency', 'generic', ResponseStatus.InsuficcientCurrency],
    ];

    for (const [reason, kind, status] of cases) {
      test(`"${reason}" -> ${kind}:${status}`, () => {
        const outcome = classifyFailureReason(reason);
        expect(outcome).toBeDefined();
        expect(outcome!.kind).toBe(kind);
        expect(outcome!.status).toBe(status);
      });
    }
  });

  test('a credentials failure is InvalidParameters, not NotValidCombo', () => {
    // The exact regression: 'Invalid or incomplete parameters' contains
    // "invalid", so the old cascade classified it as NotValidCombo.
    const outcome = classifyFailureReason('Invalid or incomplete parameters');
    expect(outcome!.status).toBe(CodeSubmitStatus.InvalidParameters);
    expect(outcome!.status).not.toBe(CodeSubmitStatus.NotValidCombo);
  });

  test('can_not_redeem_combination is CannotRedeem, not a fallthrough', () => {
    const outcome = classifyFailureReason('can_not_redeem_combination');
    expect(outcome!.status).toBe(CodeSubmitStatus.CannotRedeem);
  });

  test('matching is case-insensitive and tolerates surrounding whitespace', () => {
    expect(classifyFailureReason('  OFFER_HAS_EXPIRED  ')!.status).toBe(CodeSubmitStatus.Expired);
    expect(classifyFailureReason('Already_Redeemed')!.status).toBe(
      CodeSubmitStatus.AlreadyRedeemed
    );
  });

  test('returns undefined for an unknown reason so the caller can log it', () => {
    // A silent default is what let an upstream wording change tell every user
    // that every valid code was invalid.
    expect(classifyFailureReason('coupon_claimed_2027')).toBeUndefined();
    expect(classifyFailureReason('')).toBeUndefined();
  });
});

describe('exported status enums', () => {
  // Six files previously hardcoded these ordinals. Pin them so that reordering
  // a member is a test failure rather than a silent reclassification.
  test('CodeSubmitStatus ordinals are stable', () => {
    expect(CodeSubmitStatus.Success).toBe(0);
    expect(CodeSubmitStatus.AlreadyRedeemed).toBe(1);
    expect(CodeSubmitStatus.InvalidParameters).toBe(2);
    expect(CodeSubmitStatus.NotValidCombo).toBe(3);
    expect(CodeSubmitStatus.Expired).toBe(4);
    expect(CodeSubmitStatus.CannotRedeem).toBe(5);
  });

  test('ResponseStatus ordinals are stable', () => {
    expect(ResponseStatus.Success).toBe(0);
    expect(ResponseStatus.OutdatedInstanceId).toBe(1);
    expect(ResponseStatus.Failed).toBe(2);
    expect(ResponseStatus.InsuficcientCurrency).toBe(3);
    expect(ResponseStatus.SwitchServer).toBe(4);
  });
});
