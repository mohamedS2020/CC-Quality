import { ScoringMode } from "@prisma/client";
import type { LoadedErrorReason, LoadedSection } from "@/lib/config/loader";
import { gradedAttributesPlugin } from "@/lib/engine/scoring/gradedAttributes";
import { getScoringPlugin } from "@/lib/engine/scoring";

const section = (attributeCount: number, capPerAttribute = false): LoadedSection =>
  ({ attributeCount, capPerAttribute }) as unknown as LoadedSection;

const reason = (attributeId: number): LoadedErrorReason =>
  ({ attributeId }) as unknown as LoadedErrorReason;

describe("graded_attributes scoring (§5.2)", () => {
  it("scores a clean call as 1 (verified: 0 → 1.0)", () => {
    expect(gradedAttributesPlugin.scoreCall(section(6), [])).toEqual({
      accuracy: 1,
      errorCount: 0,
      accountNumerator: 0,
      accountDenominator: 6,
    });
  });

  it("grades over the derived N (verified: 2 errors → 1 − 2/6 = 0.6667)", () => {
    const score = gradedAttributesPlugin.scoreCall(section(6), [reason(1), reason(2)]);
    expect(score.accuracy).toBeCloseTo(2 / 3, 6);
    expect(score.accountNumerator).toBe(2);
    expect(score.accountDenominator).toBe(6);
  });

  it("uncapped (default) counts every sub-reason, even two under one attribute", () => {
    const score = gradedAttributesPlugin.scoreCall(section(6, false), [reason(1), reason(1)]);
    expect(score.accountNumerator).toBe(2);
    expect(score.accuracy).toBeCloseTo(1 - 2 / 6, 6);
  });

  it("capped counts distinct failed attributes (two under one attribute → 1)", () => {
    const score = gradedAttributesPlugin.scoreCall(section(6, true), [reason(1), reason(1)]);
    expect(score.accountNumerator).toBe(1);
    expect(score.accuracy).toBeCloseTo(1 - 1 / 6, 6);
    expect(score.errorCount).toBe(2); // raw error count is unaffected by capping
  });

  it("returns NaN accuracy for a zero denominator (divide-by-zero → n/a)", () => {
    expect(gradedAttributesPlugin.scoreCall(section(0), [reason(1)]).accuracy).toBeNaN();
  });

  it("is resolvable from the registry by mode", () => {
    expect(getScoringPlugin(ScoringMode.GRADED_ATTRIBUTES)).toBe(gradedAttributesPlugin);
  });
});
