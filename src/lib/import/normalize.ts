/**
 * Text normalisation for wide-format import matching (pure). Source spreadsheets
 * use a drifting vocabulary (curly apostrophes, `/` vs ` - `, spacing), so we
 * normalise both sides before comparing, and keep a looser form for fuzzy hints.
 */

const APOS = /[‘’ʼ`´]/g;
const QUOTE = /[“”]/g;

/** Lowercase, unify apostrophes/quotes, collapse whitespace, trim. */
export function normalizeReason(s: string): string {
  return s.toLowerCase().replace(APOS, "'").replace(QUOTE, '"').replace(/\s+/g, " ").trim();
}

/** normaliseReason + treat separators/punctuation as spaces (fuzzy comparisons). */
export function looseReason(s: string): string {
  return normalizeReason(s)
    .replace(/[\/\-–—.,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Source section-header codes that differ from the config's codes. */
const SECTION_HEADER_ALIAS: Record<string, string> = { EC: "EUC" };

/**
 * Resolve a spreadsheet section-column header (e.g. "CC", "EC") to a config
 * section code, or null if it isn't a section column. Matching is case-insensitive.
 */
export function sectionCodeFor(header: string, configCodes: readonly string[]): string | null {
  const upper = header.trim().toUpperCase();
  if (!upper) return null;
  const byUpper = new Map(configCodes.map((c) => [c.toUpperCase(), c]));
  if (byUpper.has(upper)) return byUpper.get(upper)!;
  const aliased = SECTION_HEADER_ALIAS[upper];
  if (aliased && byUpper.has(aliased.toUpperCase())) return byUpper.get(aliased.toUpperCase())!;
  return null;
}
