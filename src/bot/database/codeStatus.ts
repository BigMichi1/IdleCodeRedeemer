import { CodeSubmitStatus } from '../api/idleChampionsApi';

/**
 * The canonical redemption statuses stored in redeemed_codes.status.
 *
 * These were previously bare string literals compared at a dozen query sites
 * against a Record<number, string> declared 400 lines away, with no type-level
 * link between them. A typo in any comparison silently returned zero rows, so
 * the bot would re-redeem or skip codes forever with no error.
 */
export const CODE_STATUSES = [
  'Success',
  'Already Redeemed',
  'Invalid Parameters',
  'Not a Valid Code',
  'Code Expired',
  'Cannot Redeem',
  'Unknown Status',
] as const;

export type CodeStatus = (typeof CODE_STATUSES)[number];

/**
 * Wire status -> stored status.
 *
 * Typed as Record<CodeSubmitStatus, CodeStatus>, so adding a member to the API
 * enum without handling it here is a compile error rather than a silent
 * "Unknown Status" at runtime.
 */
export const CODE_STATUS_MAP: Record<CodeSubmitStatus, CodeStatus> = {
  [CodeSubmitStatus.Success]: 'Success',
  [CodeSubmitStatus.AlreadyRedeemed]: 'Already Redeemed',
  [CodeSubmitStatus.InvalidParameters]: 'Invalid Parameters',
  [CodeSubmitStatus.NotValidCombo]: 'Not a Valid Code',
  [CodeSubmitStatus.Expired]: 'Code Expired',
  [CodeSubmitStatus.CannotRedeem]: 'Cannot Redeem',
};

/** Statuses that count as "this user has dealt with this code already". */
export const SETTLED_STATUSES = [
  'Success',
  'Already Redeemed',
  'Code Expired',
] as const satisfies readonly CodeStatus[];

export function isCodeStatus(value: string): value is CodeStatus {
  return (CODE_STATUSES as readonly string[]).includes(value);
}
