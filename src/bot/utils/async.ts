/** Pause for `ms` milliseconds. Replaces five hand-rolled setTimeout promises. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Message text for a caught value.
 *
 * `catch` binds `unknown`, so the `instanceof Error` dance was repeated at seven
 * call sites. Non-Error throws still need to say something useful.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
