/**
 * @jest-environment node
 *
 * Reconciliation harness (FR-46). Proves the engine reproduces the verified
 * figures (Appendix C + §11) end-to-end through the REAL baseline config: it
 * materializes a fresh copy of the baseline, loads it, picks real error-reason
 * ids from the actual rubric, builds the documented scenarios, and asserts the
 * published numbers. The config is created inactive and removed afterwards, so
 * it neither needs the seed nor disturbs the active pointer (CI-safe).
 */
import { prisma } from "@/lib/db/client";
import { baselineConfigInput } from "@/lib/config/baseline";
import { createConfigVersion } from "@/lib/config/versioning";
import { loadConfigById, type LoadedConfig, type LoadedSection } from "@/lib/config/loader";
import { agentSectionAccuracy, scoreCall } from "@/lib/engine/score";
import { computeLens } from "@/lib/engine/lenses";
import { computeAgentRank } from "@/lib/engine/rank";
import type { ScoredCall } from "@/lib/engine/types";

let config: LoadedConfig;
let createdConfigId: number;
let cc: LoadedSection;
let euc: LoadedSection;
let bc: LoadedSection;
let nc: LoadedSection;
let ccReason: number;
let bcReason: number;
let ncReasonA: number;
let ncReasonB: number;

const sectionByCode = (cfg: LoadedConfig, code: string): LoadedSection => {
  const section = cfg.sections.find((s) => s.code === code);
  if (!section) throw new Error(`baseline missing section ${code}`);
  return section;
};

/** Flip NC to capped scoring in-memory to check the opt-in path. */
function withCappedSection(cfg: LoadedConfig, sectionId: number): LoadedConfig {
  const sections = cfg.sections.map((s) =>
    s.id === sectionId ? { ...s, capPerAttribute: true } : s,
  );
  return { ...cfg, sections, sectionById: new Map(sections.map((s) => [s.id, s])) };
}

// The Appendix C month: 75 calls — 1 CC, 0 EUC, 2 BC, 32 NC sub-reasons; 2 of the
// NC calls put two sub-reasons under one attribute (→ 30 capped).
function buildAccountCalls(cfg: LoadedConfig): ScoredCall[] {
  const calls: ScoredCall[] = [
    scoreCall(cfg, [ccReason]),
    scoreCall(cfg, [bcReason]),
    scoreCall(cfg, [bcReason]),
    ...Array.from({ length: 28 }, () => scoreCall(cfg, [ncReasonA])),
    scoreCall(cfg, [ncReasonA, ncReasonB]),
    scoreCall(cfg, [ncReasonA, ncReasonB]),
  ];
  while (calls.length < 75) calls.push(scoreCall(cfg, []));
  return calls;
}

beforeAll(async () => {
  const created = await createConfigVersion(baselineConfigInput);
  createdConfigId = created.id;
  const loaded = await loadConfigById(created.id);
  if (!loaded) throw new Error("baseline config failed to load");
  config = loaded;

  cc = sectionByCode(config, "CC");
  euc = sectionByCode(config, "EUC");
  bc = sectionByCode(config, "BC");
  nc = sectionByCode(config, "NC");

  ccReason = cc.attributes[0].errorReasons[0].id;
  bcReason = bc.attributes[0].errorReasons[0].id;
  const ncAttr = nc.attributes.find((a) => a.errorReasons.length >= 2);
  if (!ncAttr) throw new Error("NC has no attribute with ≥2 reasons");
  ncReasonA = ncAttr.errorReasons[0].id;
  ncReasonB = ncAttr.errorReasons[1].id; // same attribute as A
});

afterAll(async () => {
  await prisma.scorecardConfig.deleteMany({ where: { id: createdConfigId } });
  await prisma.$disconnect();
});

describe("Account lens — Appendix C (75 calls)", () => {
  it("reproduces CC 98.67 / EUC 100 / BC 97.33 / NC 92.89 (uncapped default)", () => {
    const account = config.lensByKey.get("account")!;
    const result = computeLens(account, config, buildAccountCalls(config));
    expect(result.sections.get(cc.id)?.accuracy).toBeCloseTo(1 - 1 / 75, 6);
    expect(result.sections.get(euc.id)?.accuracy).toBe(1);
    expect(result.sections.get(bc.id)?.accuracy).toBeCloseTo(1 - 2 / 75, 6);
    expect(result.sections.get(nc.id)?.accuracy).toBeCloseTo(1 - 32 / 450, 6);
  });

  it("applies benchmark status with ≥ (CC fail, EUC/BC pass, NC fail)", () => {
    const account = config.lensByKey.get("account")!;
    const result = computeLens(account, config, buildAccountCalls(config));
    expect(result.sections.get(cc.id)?.status).toBe("fail");
    expect(result.sections.get(euc.id)?.status).toBe("pass");
    expect(result.sections.get(bc.id)?.status).toBe("pass");
    expect(result.sections.get(nc.id)?.status).toBe("fail");
  });

  it("reproduces NC 93.33 with cap_per_attribute (the 32↔30 gap)", () => {
    const capped = withCappedSection(config, nc.id);
    const account = capped.lensByKey.get("account")!;
    const result = computeLens(account, capped, buildAccountCalls(capped));
    expect(result.sections.get(nc.id)?.accuracy).toBeCloseTo(1 - 30 / 450, 6);
  });
});

describe("Agent Hager — §11 (15 calls, 7 NC, no criticals)", () => {
  it("reproduces NC 92.22% and rank 70%", () => {
    const calls = [
      ...Array.from({ length: 7 }, () => scoreCall(config, [ncReasonA])),
      ...Array.from({ length: 8 }, () => scoreCall(config, [])),
    ];
    const accuracy = agentSectionAccuracy(config, calls);
    expect(accuracy.get(nc.id)).toBeCloseTo(83 / 90, 6);
    expect(accuracy.get(cc.id)).toBe(1);
    expect(computeAgentRank(config, accuracy)).toBe(70);
  });
});
