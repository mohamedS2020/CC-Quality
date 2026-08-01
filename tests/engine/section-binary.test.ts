import { ScoringMode } from "@prisma/client";
import type { LoadedErrorReason, LoadedSection } from "@/lib/config/loader";
import { sectionBinaryPlugin } from "@/lib/engine/scoring/sectionBinary";
import { getScoringPlugin } from "@/lib/engine/scoring";

const section = {} as unknown as LoadedSection; // binary ignores the section
const reasons = (n: number): LoadedErrorReason[] =>
  Array.from({ length: n }, () => ({}) as unknown as LoadedErrorReason);

describe("section_binary scoring (§5.1)", () => {
  it("scores a clean call as a full pass", () => {
    expect(sectionBinaryPlugin.scoreCall(section, reasons(0))).toEqual({
      accuracy: 1,
      errorCount: 0,
      accountNumerator: 0,
      accountDenominator: 1,
    });
  });

  it("fails the whole section on any error (go/no-go)", () => {
    expect(sectionBinaryPlugin.scoreCall(section, reasons(1)).accuracy).toBe(0);
  });

  it("counts every error for the Account lens even though the call already failed", () => {
    const score = sectionBinaryPlugin.scoreCall(section, reasons(2));
    expect(score.accuracy).toBe(0);
    expect(score.errorCount).toBe(2);
    expect(score.accountNumerator).toBe(2);
    expect(score.accountDenominator).toBe(1);
  });

  it("resolves the plugin from the registry by mode", () => {
    expect(getScoringPlugin(ScoringMode.SECTION_BINARY)).toBe(sectionBinaryPlugin);
  });

  it("throws for an unregistered mode", () => {
    expect(() => getScoringPlugin("BOGUS" as unknown as ScoringMode)).toThrow();
  });
});
