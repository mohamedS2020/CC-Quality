/**
 * Reporting metric layer (task 9): buildReport derives every chart's data from
 * the engine — section accuracy vs benchmark (+ delta), agent comparison
 * (worst-first), leaderboard (rank desc), and KPIs (pass rate + delta). Pure —
 * a hand-built config with a binary+critical CC section and a graded NC section.
 */
import { LensBasis, ScoringMode } from "@prisma/client";
import { buildReport, pickLens, type ReportCall } from "@/lib/reports/metrics";
import type { LoadedConfig, LoadedErrorReason, LoadedSection } from "@/lib/config/loader";

const cc1000: LoadedErrorReason = {
  id: 1000,
  label: "CC error",
  orderIndex: 0,
  attributeId: 100,
  sectionId: 1,
  dictionary: null,
};
const nc2000: LoadedErrorReason = {
  id: 2000,
  label: "NC error",
  orderIndex: 0,
  attributeId: 200,
  sectionId: 2,
  dictionary: null,
};
const attrCC = {
  id: 100,
  label: "CC attr",
  orderIndex: 0,
  categoryId: 10,
  sectionId: 1,
  errorReasons: [cc1000],
};
const attrNC = {
  id: 200,
  label: "NC attr",
  orderIndex: 0,
  categoryId: 20,
  sectionId: 2,
  errorReasons: [nc2000],
};

const cc: LoadedSection = {
  id: 1,
  code: "CC",
  label: "Call Compliance",
  orderIndex: 0,
  scoringMode: ScoringMode.SECTION_BINARY,
  critical: true,
  capPerAttribute: false,
  rankWeight: 60,
  rankBenchmark: 0.9,
  categories: [{ id: 10, label: "c", orderIndex: 0, sectionId: 1, attributes: [attrCC] }],
  attributes: [attrCC],
  attributeCount: 1,
};
const nc: LoadedSection = {
  id: 2,
  code: "NC",
  label: "Non Critical",
  orderIndex: 1,
  scoringMode: ScoringMode.GRADED_ATTRIBUTES,
  critical: false,
  capPerAttribute: false,
  rankWeight: 40,
  rankBenchmark: 0.9,
  categories: [{ id: 20, label: "c", orderIndex: 0, sectionId: 2, attributes: [attrNC] }],
  attributes: [attrNC],
  attributeCount: 1,
};

const config: LoadedConfig = {
  id: 1,
  version: 1,
  name: "Test",
  isActive: true,
  roundingDecimals: 2,
  paretoCutoff: 0.8,
  newAgentTenureDays: 90,
  trialWindowDays: 90,
  sections: [cc, nc],
  lenses: [
    {
      id: 1,
      key: "account",
      label: "Account",
      basis: LensBasis.PER_ERROR,
      orderIndex: 0,
      benchmarks: new Map([
        [1, 0.95],
        [2, 0.9],
      ]),
    },
  ],
  severities: [],
  trainingBuckets: [],
  sectionById: new Map([
    [1, cc],
    [2, nc],
  ]),
  errorReasonById: new Map([
    [1000, cc1000],
    [2000, nc2000],
  ]),
  lensByKey: new Map(),
};

const lens = pickLens(config)!;

// A (login 1): a clean call + a CC-critical failure. B (login 2): one clean call.
const current: ReportCall[] = [
  { agentLoginId: 1, agentName: "Ann", reasonIds: [], failedScorecard: false },
  { agentLoginId: 1, agentName: "Ann", reasonIds: [1000], failedScorecard: true },
  { agentLoginId: 2, agentName: "Bo", reasonIds: [], failedScorecard: false },
];
// Previous period: everyone clean (so current shows a drop).
const previous: ReportCall[] = [
  { agentLoginId: 1, agentName: "Ann", reasonIds: [], failedScorecard: false },
  { agentLoginId: 2, agentName: "Bo", reasonIds: [], failedScorecard: false },
];

describe("buildReport", () => {
  it("computes scope section accuracy vs benchmark, with delta vs last period", () => {
    const r = buildReport(config, lens, current, previous);
    const ccRow = r.sections.find((s) => s.code === "CC")!;
    // 1 CC error over 3 calls → 1 − 1/3 ≈ 0.667, below 0.95 → fail.
    expect(ccRow.accuracy).toBeCloseTo(2 / 3);
    expect(ccRow.status).toBe("fail");
    expect(ccRow.delta).toBeCloseTo(2 / 3 - 1); // dropped from a clean prior period

    const ncRow = r.sections.find((s) => s.code === "NC")!;
    expect(ncRow.accuracy).toBeCloseTo(1);
    expect(ncRow.status).toBe("pass");
  });

  it("ranks agents worst-first for the comparison, best-first for the leaderboard", () => {
    const r = buildReport(config, lens, current, previous);

    // Ann (mean 0.75) is worse than Bo (1.0) → Ann first.
    expect(r.agentComparison.map((a) => a.agentName)).toEqual(["Ann", "Bo"]);

    // Rank: Bo clears both sections (100); Ann misses CC (0.5 < 0.9) → 40.
    expect(r.leaderboard.map((a) => ({ name: a.agentName, rank: a.rank }))).toEqual([
      { name: "Bo", rank: 100 },
      { name: "Ann", rank: 40 },
    ]);
  });

  it("computes KPIs (calls, agents, pass rate + delta)", () => {
    const r = buildReport(config, lens, current, previous);
    expect(r.kpis.callCount).toBe(3);
    expect(r.kpis.agentCount).toBe(2);
    expect(r.kpis.passRate).toBeCloseTo(2 / 3);
    expect(r.kpis.passRateDelta).toBeCloseTo(2 / 3 - 1);
  });

  it("reports no delta when there is no previous period", () => {
    const r = buildReport(config, lens, current, []);
    expect(r.sections.every((s) => s.delta === null)).toBe(true);
    expect(r.kpis.passRateDelta).toBeNull();
  });
});
