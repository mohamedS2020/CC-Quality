/**
 * Password policy. Kept deliberately minimal for now (length floor) and in its
 * own server-safe module (no server-only import) so it can be reused by the
 * seed, user-management, and reset flows alike.
 */
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordValidation = { ok: true } | { ok: false; error: string };

export function validatePassword(password: string): PasswordValidation {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  return { ok: true };
}
