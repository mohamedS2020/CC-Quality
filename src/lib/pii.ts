/**
 * Mobile PII policy (FR-19):
 *  - MASK ON STORE: only the masked form (`maskMobile`) is ever persisted — the
 *    raw number never touches the database (the schema has no raw column).
 *  - MASK ON DISPLAY: any UI showing a mobile renders the stored masked value
 *    through `displayMobile`.
 *  - NEVER IN URLS: a mobile (raw or masked) must never appear in a path, query
 *    string, or redirect — entry travels in a POST body only. Enforced by the
 *    `pii-url-guard` test.
 */

/** Mask a mobile: keep only the last 4 digits, mask the rest. */
export function maskMobile(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  const visible = 4;
  if (trimmed.length <= visible) return "*".repeat(trimmed.length);
  return "*".repeat(trimmed.length - visible) + trimmed.slice(-visible);
}

/** Format a stored (already-masked) mobile for display; empty/null → an em dash. */
export function displayMobile(masked: string | null | undefined): string {
  return masked && masked.trim() !== "" ? masked : "—";
}

/**
 * Reduce a phone-number search query to the last 4 digits — the only part kept
 * unmasked in storage — so a search can match the stored masked value by suffix.
 * Full number or last-4 both work; non-digits are ignored. Empty when no digits.
 */
export function phoneSearchDigits(query: string): string {
  return query.replace(/\D/g, "").slice(-4);
}
