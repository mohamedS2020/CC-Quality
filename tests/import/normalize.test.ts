import { looseReason, normalizeReason, sectionCodeFor } from "@/lib/import/normalize";

describe("normalizeReason", () => {
  it("lowercases, unifies apostrophes, and collapses whitespace", () => {
    expect(normalizeReason("Didn’t   avoid  Dead Air")).toBe("didn't avoid dead air");
    expect(normalizeReason("Didn't avoid dead air")).toBe("didn't avoid dead air");
  });
});

describe("looseReason", () => {
  it("treats slashes and dashes as spaces (so separator variants match)", () => {
    expect(looseReason("Sleepy/Not energetic tone")).toBe(
      looseReason("Sleepy - Not energetic tone"),
    );
    expect(looseReason("Used jargon/slang language")).toBe(
      looseReason("Used jargon - slang language"),
    );
  });
});

describe("sectionCodeFor", () => {
  const codes = ["CC", "EUC", "BC", "NC"];
  it("maps EC → EUC and matches config codes case-insensitively", () => {
    expect(sectionCodeFor("CC", codes)).toBe("CC");
    expect(sectionCodeFor("EC", codes)).toBe("EUC");
    expect(sectionCodeFor("ec", codes)).toBe("EUC");
    expect(sectionCodeFor("NC", codes)).toBe("NC");
  });
  it("returns null for non-section headers", () => {
    expect(sectionCodeFor("TEAM LEADER", codes)).toBeNull();
    expect(sectionCodeFor("Call Date", codes)).toBeNull();
  });
});
