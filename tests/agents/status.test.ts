import { deriveAgentStanding, tenureDays } from "@/lib/agents/status";

/**
 * Tenure standing (FR-13, task 7.5): status (old/new) and in_trial are derived
 * from join_date against the CONFIGURED thresholds — the two boundaries are
 * independent config values, never hardcoded.
 */
const asOf = new Date("2026-08-02T00:00:00Z");
const daysBefore = (n: number) => new Date(asOf.getTime() - n * 86_400_000);

describe("deriveAgentStanding", () => {
  const config = { newAgentTenureDays: 90, trialWindowDays: 90 };

  it("counts whole days of tenure, never negative", () => {
    expect(tenureDays(daysBefore(30), asOf)).toBe(30);
    expect(tenureDays(daysBefore(0), asOf)).toBe(0);
    expect(tenureDays(new Date("2027-01-01"), asOf)).toBe(0); // future join → 0, not negative
  });

  it("is new + in trial below the thresholds", () => {
    expect(deriveAgentStanding(daysBefore(30), config, asOf)).toEqual({
      tenureDays: 30,
      status: "new",
      inTrial: true,
    });
  });

  it("flips to old + out of trial at the boundary (day === threshold)", () => {
    expect(deriveAgentStanding(daysBefore(90), config, asOf)).toMatchObject({
      status: "old",
      inTrial: false,
    });
    expect(deriveAgentStanding(daysBefore(89), config, asOf)).toMatchObject({
      status: "new",
      inTrial: true,
    });
  });

  it("treats the two thresholds independently", () => {
    // Longer new-agent window than trial window: still "new" but no longer in trial.
    const split = { newAgentTenureDays: 90, trialWindowDays: 30 };
    expect(deriveAgentStanding(daysBefore(60), split, asOf)).toMatchObject({
      status: "new",
      inTrial: false,
    });
  });
});
