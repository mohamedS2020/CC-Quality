/**
 * Agent scorecard metrics (task 8, FR-34/35/37): section accuracy via the
 * Account lens, Agent Rank vs each section's rank benchmark, and training
 * recommendations from error → training bucket. Pure — a hand-built config with
 * one binary+critical section and one graded section.
 */
import { LensBasis, ScoringMode } from "@prisma/client";
import { buildScorecard } from "@/lib/dashboard/agentScorecard";
import type { LoadedConfig, LoadedErrorReason, LoadedSection } from "@/lib/config/loader";

const ccReason: LoadedErrorReason = {
  id: 1000,
  label: "CC error",
  orderIndex: 0,
  attributeId: 100,
  sectionId: 1,
  dictionary: null,
};
const nc2000: LoadedErrorReason = {
  id: 2000,
  label: "NC error A",
  orderIndex: 0,
  attributeId: 200,
  sectionId: 2,
  dictionary: {
    id: 1,
    errorReasonId: 2000,
    definition: null,
    severity: null,
    trainingBucket: "Telephone etiquette",
    thresholds: [],
  },
};
const nc2001: LoadedErrorReason = {
  id: 2001,
  label: "NC error B",
  orderIndex: 1,
  attributeId: 201,
  sectionId: 2,
  dictionary: null,
};

const attrCC = {
  id: 100,
  label: "CC attr",
  orderIndex: 0,
  categoryId: 10,
  sectionId: 1,
  errorReasons: [ccReason],
};
const attrNC1 = {
  id: 200,
  label: "NC attr 1",
  orderIndex: 0,
  categoryId: 20,
  sectionId: 2,
  errorReasons: [nc2000],
};
const attrNC2 = {
  id: 201,
  label: "NC attr 2",
  orderIndex: 1,
  categoryId: 20,
  sectionId: 2,
  errorReasons: [nc2001],
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
  categories: [{ id: 10, label: "cat", orderIndex: 0, sectionId: 1, attributes: [attrCC] }],
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
  rankBenchmark: 0.7,
  categories: [
    { id: 20, label: "cat", orderIndex: 0, sectionId: 2, attributes: [attrNC1, attrNC2] },
  ],
  attributes: [attrNC1, attrNC2],
  attributeCount: 2,
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
  trainingBuckets: ["Telephone etiquette"],
  sectionById: new Map([
    [1, cc],
    [2, nc],
  ]),
  errorReasonById: new Map([
    [1000, ccReason],
    [2000, nc2000],
    [2001, nc2001],
  ]),
  lensByKey: new Map(),
};

describe("buildScorecard", () => {
  // Two calls: one with a CC critical error, one with a single NC error.
  const calls = [{ reasonIds: [1000] }, { reasonIds: [2000] }];

  it("computes Account-lens section accuracy + pass/fail", () => {
    const sc = buildScorecard(config, calls);
    expect(sc.callCount).toBe(2);

    const ccRow = sc.sectionAccuracy.find((s) => s.code === "CC")!;
    // binary: 1 error over 2 calls → 1 − 1/2 = 0.5, below the 0.95 benchmark.
    expect(ccRow.accuracy).toBeCloseTo(0.5);
    expect(ccRow.status).toBe("fail");

    const ncRow = sc.sectionAccuracy.find((s) => s.code === "NC")!;
    // graded N=2: 1 failed unit over 2×2 → 1 − 1/4 = 0.75, below 0.90.
    expect(ncRow.accuracy).toBeCloseTo(0.75);
    expect(ncRow.status).toBe("fail");
  });

  it("computes rank from per-section accuracy vs the rank benchmark", () => {
    const sc = buildScorecard(config, calls);
    // CC per-call mean = (0+1)/2 = 0.5 < 0.9 → missed (weight 60).
    // NC per-call mean = (1+0.5)/2 = 0.75 ≥ 0.7 → met (weight 40).
    expect(sc.rank).toBe(40);
    expect(sc.rankBySection.find((r) => r.code === "CC")!.met).toBe(false);
    expect(sc.rankBySection.find((r) => r.code === "NC")!.met).toBe(true);
  });

  it("recommends training from the flagged errors' buckets", () => {
    const sc = buildScorecard(config, calls);
    expect(sc.training).toEqual([{ bucket: "Telephone etiquette", count: 1 }]);
  });

  it("is a clean sheet when nothing is flagged", () => {
    const sc = buildScorecard(config, [{ reasonIds: [] }]);
    expect(sc.sectionAccuracy.every((s) => s.status === "pass")).toBe(true);
    expect(sc.training).toEqual([]);
  });
});
