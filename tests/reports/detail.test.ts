/**
 * Drill-down rank breakdown (item 2): each section earns its full weight only
 * when the agent's section accuracy meets that section's rank benchmark, and
 * rank is the sum of earned weights (§5.6). Pure — a minimal 2-section config.
 */
import { ScoringMode } from "@prisma/client";
import type { LoadedConfig, LoadedErrorReason, LoadedSection } from "@/lib/config/loader";
import { scoreCall } from "@/lib/engine/score";
import { rankBreakdown } from "@/lib/reports/detail";

const ccReason: LoadedErrorReason = {
  id: 1000,
  key: "cc.attr.cc-error",
  label: "CC error",
  orderIndex: 0,
  attributeId: 100,
  sectionId: 1,
  dictionary: null,
};

const cc: LoadedSection = {
  id: 1,
  code: "CC",
  label: "Critical Compliance",
  orderIndex: 0,
  scoringMode: ScoringMode.SECTION_BINARY,
  critical: true,
  capPerAttribute: false,
  rankWeight: 60,
  rankBenchmark: 0.9,
  categories: [],
  attributes: [],
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
  categories: [],
  attributes: [],
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
  lenses: [],
  severities: [],
  trainingBuckets: [],
  sectionById: new Map([
    [1, cc],
    [2, nc],
  ]),
  errorReasonById: new Map([[1000, ccReason]]),
  errorReasonByKey: new Map([[ccReason.key, ccReason]]),
  lensByKey: new Map(),
};

describe("rankBreakdown", () => {
  it("earns every section's weight for a clean agent (rank 100)", () => {
    const calls = [scoreCall(config, []), scoreCall(config, [])];
    const bd = rankBreakdown(config, calls);
    expect(bd.rank).toBe(100);
    expect(bd.sections.every((s) => s.met && s.earned === s.weight)).toBe(true);
  });

  it("drops a section's weight when its benchmark is missed", () => {
    // CC accuracy = avg(1, 0) = 0.5 < 0.9 → missed; NC clean → met.
    const calls = [scoreCall(config, []), scoreCall(config, [1000])];
    const bd = rankBreakdown(config, calls);
    const ccRow = bd.sections.find((s) => s.code === "CC")!;
    const ncRow = bd.sections.find((s) => s.code === "NC")!;
    expect(ccRow).toMatchObject({ met: false, earned: 0 });
    expect(ncRow).toMatchObject({ met: true, earned: 40 });
    expect(bd.rank).toBe(40);
  });
});
