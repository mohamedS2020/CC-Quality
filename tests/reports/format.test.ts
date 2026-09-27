/**
 * The ⓘ tooltip helper: derives opportunities-per-call from the numbers, so a
 * pass/fail section reads as 1 check per call and a graded section as N.
 */
import { countLabel, opportunityHelp } from "@/app/reports/_charts/format";

describe("countLabel", () => {
  it("is passing/total, blank when there's no data", () => {
    expect(countLabel(51, 714)).toBe("663/714");
    expect(countLabel(0, 0)).toBe("");
  });
});

describe("opportunityHelp", () => {
  it("explains a graded section as N checks per call (the real NC case)", () => {
    expect(opportunityHelp("NC", 51, 714, 119)).toBe(
      "663 of 714 checks passed. NC is graded — each of the 119 calls is checked on 6 attributes (6 × 119 = 714). Accuracy = passing ÷ opportunities.",
    );
  });

  it("explains a binary section as 1 check per call", () => {
    const help = opportunityHelp("CC", 1, 119, 119);
    expect(help).toContain("118 of 119 checks passed");
    expect(help).toContain("CC is pass/fail — each of the 119 calls is 1 check");
  });

  it("handles no data", () => {
    expect(opportunityHelp("CC", 0, 0, 0)).toBe("No CC data in this view.");
  });
});
