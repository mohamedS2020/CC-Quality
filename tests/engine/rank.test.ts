import type { LoadedConfig, LoadedErrorReason, LoadedSection } from "@/lib/config/loader";
import { agentSectionAccuracy, scoreCall } from "@/lib/engine/score";
import { computeAgentRank } from "@/lib/engine/rank";

const CC = 1;
const EUC = 2;
const BC = 3;
const NC = 4;
const BC_ERR = 30;
const NC_ERR = 40;

function makeConfig(): LoadedConfig {
  const section = (
    id: number,
    scoringMode: string,
    critical: boolean,
    rankWeight: number,
    rankBenchmark: number,
    attributeCount = 1,
  ): LoadedSection =>
    ({
      id,
      scoringMode,
      critical,
      capPerAttribute: false,
      attributeCount,
      rankWeight,
      rankBenchmark,
    }) as unknown as LoadedSection;

  const reason = (id: number, sectionId: number, attributeId: number): LoadedErrorReason =>
    ({ id, sectionId, attributeId }) as unknown as LoadedErrorReason;

  return {
    sections: [
      section(CC, "SECTION_BINARY", true, 10, 0.995),
      section(EUC, "SECTION_BINARY", true, 25, 0.98),
      section(BC, "SECTION_BINARY", true, 35, 0.95),
      section(NC, "GRADED_ATTRIBUTES", false, 30, 0.95, 6),
    ],
    errorReasonById: new Map<number, LoadedErrorReason>([
      [BC_ERR, reason(BC_ERR, BC, 300)],
      [NC_ERR, reason(NC_ERR, NC, 400)],
    ]),
  } as unknown as LoadedConfig;
}

function rankFor(config: LoadedConfig, calls: ReturnType<typeof scoreCall>[]): number {
  return computeAgentRank(config, agentSectionAccuracy(config, calls));
}

describe("Agent Rank (§5.6)", () => {
  const config = makeConfig();

  it("reproduces Hager: 15 calls, 7 NC errors, no criticals → 70%", () => {
    const calls = [
      ...Array.from({ length: 7 }, () => scoreCall(config, [NC_ERR])),
      ...Array.from({ length: 8 }, () => scoreCall(config, [])),
    ];
    // CC/EUC/BC = 100% (≥ benchmark) → 10+25+35; NC 92.22% < 95% → 0.
    expect(rankFor(config, calls)).toBe(70);
  });

  it("gives a flawless agent the full 100", () => {
    const calls = Array.from({ length: 15 }, () => scoreCall(config, []));
    expect(rankFor(config, calls)).toBe(100);
  });

  it("drops a section's weight when its benchmark is missed (BC → −35)", () => {
    // One BC error → BC call pass-rate 14/15 = 93.3% < 95% → lose BC's 35.
    const calls = [
      scoreCall(config, [BC_ERR]),
      ...Array.from({ length: 14 }, () => scoreCall(config, [])),
    ];
    expect(rankFor(config, calls)).toBe(65); // 10 + 25 + 0 + 30
  });

  it("treats n/a (no calls) sections as not meeting the benchmark → 0", () => {
    expect(computeAgentRank(config, new Map())).toBe(0);
  });
});
