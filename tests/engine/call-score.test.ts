import type { LoadedConfig, LoadedErrorReason, LoadedSection } from "@/lib/config/loader";
import { scoreCall, agentSectionAccuracy } from "@/lib/engine/score";

const CC_ID = 1;
const NC_ID = 2;

// A minimal config: one binary critical section (CC) and one graded section
// (NC, 6 attributes). Only the fields the scorer reads are populated.
function makeConfig(): LoadedConfig {
  const cc = {
    id: CC_ID,
    scoringMode: "SECTION_BINARY",
    critical: true,
    capPerAttribute: false,
    attributeCount: 1,
  } as unknown as LoadedSection;
  const nc = {
    id: NC_ID,
    scoringMode: "GRADED_ATTRIBUTES",
    critical: false,
    capPerAttribute: false,
    attributeCount: 6,
  } as unknown as LoadedSection;

  const reason = (id: number, sectionId: number, attributeId: number): LoadedErrorReason =>
    ({ id, sectionId, attributeId }) as unknown as LoadedErrorReason;

  const errorReasonById = new Map<number, LoadedErrorReason>([
    [100, reason(100, CC_ID, 10)], // a CC error
    [200, reason(200, NC_ID, 20)], // NC error under attribute 20
    [201, reason(201, NC_ID, 21)], // NC error under attribute 21
    [202, reason(202, NC_ID, 20)], // NC error under attribute 20 (same as 200)
  ]);

  return { sections: [cc, nc], errorReasonById } as unknown as LoadedConfig;
}

describe("per-call scoring (§5.1–5.3)", () => {
  const config = makeConfig();

  it("scores a clean call: every section passes, no criticals", () => {
    const call = scoreCall(config, []);
    expect(call.perSection.get(CC_ID)?.accuracy).toBe(1);
    expect(call.perSection.get(NC_ID)?.accuracy).toBe(1);
    expect(call.sumOfCriticals).toBe(0);
    expect(call.failedScorecard).toBe(false);
  });

  it("a critical error fails the section and the scorecard", () => {
    const call = scoreCall(config, [100]);
    expect(call.perSection.get(CC_ID)?.accuracy).toBe(0);
    expect(call.sumOfCriticals).toBe(1);
    expect(call.failedScorecard).toBe(true);
    expect(call.perSection.get(NC_ID)?.accuracy).toBe(1); // NC unaffected
  });

  it("grades NC over the derived N without touching sum_of_criticals", () => {
    const call = scoreCall(config, [200, 201]);
    expect(call.perSection.get(NC_ID)?.accuracy).toBeCloseTo(1 - 2 / 6, 6);
    expect(call.sumOfCriticals).toBe(0); // NC is not critical
    expect(call.failedScorecard).toBe(false);
  });
});

describe("agent × section accuracy (§5.3)", () => {
  const config = makeConfig();

  it("reproduces Hager: 15 calls, 7 NC errors → NC 83/90 = 92.22%, CC = 100%", () => {
    const calls = [
      ...Array.from({ length: 7 }, () => scoreCall(config, [200])), // 1 NC error each
      ...Array.from({ length: 8 }, () => scoreCall(config, [])), // clean
    ];
    const accuracy = agentSectionAccuracy(config, calls);
    expect(accuracy.get(NC_ID)).toBeCloseTo(83 / 90, 6);
    expect(accuracy.get(CC_ID)).toBe(1);
  });

  it("returns NaN for an agent with no calls (n/a)", () => {
    expect(agentSectionAccuracy(config, []).get(NC_ID)).toBeNaN();
  });
});
