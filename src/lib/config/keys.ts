/**
 * Stable identity for rubric leaves.
 *
 * A config version deep-copies the whole rubric tree, so an `ErrorReason.id` is
 * version-scoped: it changes every time you publish. Evaluations, however, are
 * immutable facts that must keep meaning the same thing forever. `key` is that
 * durable identity — minted once from the reason's position in the rubric, then
 * carried forward verbatim on every subsequent version (see
 * `buildInputFromLoaded`). Because it is carried rather than recomputed, a later
 * rename of the section, attribute or reason label does NOT change it.
 *
 * Must stay in sync with the backfill in
 * `prisma/migrations/20260927100000_add_error_reason_stable_key`.
 */

/** Lowercase, collapse every run of non-alphanumerics to "-", trim the edges. */
function slugifyPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Derive the key for a brand-new reason. Section code + attribute label + reason
 * label is unique within a config, so derived keys never collide.
 */
export function reasonKey(
  sectionCode: string,
  attributeLabel: string,
  reasonLabel: string,
): string {
  return [sectionCode, attributeLabel, reasonLabel].map(slugifyPart).join(".");
}
