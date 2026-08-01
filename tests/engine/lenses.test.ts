import type {
  LoadedConfig,
  LoadedErrorReason,
  LoadedLens,
  LoadedSection,
} from "@/lib/config/loader";
import { scoreCall } from "@/lib/engine/score";
import { computeAllLenses, computeLens } from "@/lib/engine/lenses";

const CC = 1;
const EUC = 2;
const BC = 3;
const NC = 4;

// Reason ids, one per section (attribute ids are arbitrary).
const CC_ERR = 10;
const EUC_ERR = 20;
const BC_ERR = 30;
const NC_ERR = 40;

function makeConfig(): LoadedConfig {
  const section = (
    id: number,
    scoringMode: string,
    critical: boolean,
    attributeCount = 1,
  ): LoadedSection =>
    ({
      id,
      scoringMode,
      critical,
      capPerAttribute: false,
      attributeCount,
    }) as unknown as LoadedSection;

  const reason = (id: number, sectionId: number, attributeId: number): LoadedErrorReason =>
    ({ id, sectionId, attributeId }) as unknown as LoadedErrorReason;

  const lens = (key: string, basis: string, benchmarks: [number, number][]): LoadedLens =>
    ({ key, basis, benchmarks: new Map(benchmarks) }) as unknown as LoadedLens;

  return {
    sections: [
      section(CC, "SECTION_BINARY", true),
      section(EUC, "SECTION_BINARY", true),
      section(BC, "SECTION_BINARY", true),
      section(NC, "GRADED_ATTRIBUTES", false, 6),
    ],
    lenses: [
      lens("account", "PER_ERROR", [
        [CC, 0.995],
        [EUC, 0.98],
        [BC, 0.95],
        [NC, 0.95],
      ]),
      lens("program", "PER_SCORESHEET", [
        [CC, 0.995],
        [EUC, 0.95],
        [BC, 0.9],
        [NC, 0.95],
      ]),
      lens("agent", "FAILED_SCORESHEETS", [
        [CC, 0.995],
        [EUC, 0.95],
        [BC, 0.9],
        [NC, 0.95],
      ]),
    ],
    errorReasonById: new Map<number, LoadedErrorReason>([
      [CC_ERR, reason(CC_ERR, CC, 100)],
      [EUC_ERR, reason(EUC_ERR, EUC, 200)],
      [BC_ERR, reason(BC_ERR, BC, 300)],
      [NC_ERR, reason(NC_ERR, NC, 400)],
    ]),
  } as unknown as LoadedConfig;
}

// The Appendix C month: 75 calls with 1 CC, 0 EUC, 2 BC, 32 NC errors.
function appendixCCalls(config: LoadedConfig) {
  const calls = [
    scoreCall(config, [CC_ERR]),
    scoreCall(config, [BC_ERR]),
    scoreCall(config, [BC_ERR]),
    ...Array.from({ length: 32 }, () => scoreCall(config, [NC_ERR])),
  ];
  while (calls.length < 75) calls.push(scoreCall(config, []));
  return calls;
}

describe("Account lens — Appendix C reconciliation (§5.4)", () => {
  const config = makeConfig();
  const account = config.lenses.find((l) => l.key === "account")!;
  const result = computeLens(account, config, appendixCCalls(config));

  it("reproduces CC 98.67 / EUC 100 / BC 97.33 / NC 92.89", () => {
    expect(result.sections.get(CC)?.accuracy).toBeCloseTo(1 - 1 / 75, 6);
    expect(result.sections.get(EUC)?.accuracy).toBe(1);
    expect(result.sections.get(BC)?.accuracy).toBeCloseTo(1 - 2 / 75, 6);
    expect(result.sections.get(NC)?.accuracy).toBeCloseTo(1 - 32 / 450, 6);
  });

  it("compares each section to its benchmark with ≥ (§5.8)", () => {
    expect(result.sections.get(CC)?.status).toBe("fail"); // 98.67 < 99.5
    expect(result.sections.get(EUC)?.status).toBe("pass"); // 100 ≥ 98
    expect(result.sections.get(BC)?.status).toBe("pass"); // 97.33 ≥ 95
    expect(result.sections.get(NC)?.status).toBe("fail"); // 92.89 < 95
  });
});

describe("Program & Agent lenses (provisional §5.4)", () => {
  const config = makeConfig();
  const lenses = computeAllLenses(config, appendixCCalls(config));

  it("Program counts score sheets with an error in the section", () => {
    // 32 sheets have an NC error, 1 has a CC error.
    expect(lenses.get("program")?.sections.get(NC)?.accuracy).toBeCloseTo(1 - 32 / 75, 6);
    expect(lenses.get("program")?.sections.get(CC)?.accuracy).toBeCloseTo(1 - 1 / 75, 6);
  });

  it("Agent counts failed scorecards (critical errors) over score sheets", () => {
    // 3 failed scorecards: 1 CC + 2 BC calls; NC is non-critical.
    expect(lenses.get("agent")?.sections.get(CC)?.accuracy).toBeCloseTo(1 - 3 / 75, 6);
    expect(lenses.get("agent")?.sections.get(NC)?.accuracy).toBeCloseTo(1 - 3 / 75, 6);
  });
});

describe("divide-by-zero renders as n/a (FR-26)", () => {
  const config = makeConfig();

  it("returns NaN accuracy and 'na' status when there are no calls", () => {
    const account = config.lenses.find((l) => l.key === "account")!;
    const result = computeLens(account, config, []);
    expect(result.sections.get(CC)?.accuracy).toBeNaN();
    expect(result.sections.get(CC)?.status).toBe("na");
  });
});
