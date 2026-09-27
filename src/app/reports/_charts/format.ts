/**
 * The "passing/total" count behind an accuracy % (accuracy = 1 − numerator/denominator),
 * so every percentage can show the value it represents — e.g. `98% (49/50)`.
 * Returns "" when there's no data (denominator 0), so callers can omit it.
 */
export function countLabel(numerator: number, denominator: number): string {
  if (!(denominator > 0)) return "";
  return `${Math.round(denominator - numerator)}/${Math.round(denominator)}`;
}

/**
 * Plain-language explanation of what a section's "passing/total" count means, for
 * an ⓘ tooltip. Opportunities-per-call is derived from the numbers themselves
 * (denominator ÷ calls), so it stays correct whatever the section type or lens:
 * a pass/fail section is 1 check per call, a graded section is N (its attributes).
 */
export function opportunityHelp(
  code: string,
  numerator: number,
  denominator: number,
  callCount: number,
): string {
  if (!(denominator > 0) || callCount <= 0) return `No ${code} data in this view.`;
  const total = Math.round(denominator);
  const passing = total - Math.round(numerator);
  const perCall = Math.max(1, Math.round(denominator / callCount));
  const basis =
    perCall <= 1
      ? `${code} is pass/fail — each of the ${callCount} calls is 1 check (any error fails the section)`
      : `${code} is graded — each of the ${callCount} calls is checked on ${perCall} attributes (${perCall} × ${callCount} = ${total})`;
  return `${passing} of ${total} checks passed. ${basis}. Accuracy = passing ÷ opportunities.`;
}
