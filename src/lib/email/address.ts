/** Email address helpers shared by agents and users (pure). */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim + lowercase, so "Ann@X.com " and "ann@x.com" are the same address. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL.test(email);
}
