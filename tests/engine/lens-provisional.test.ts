import { LensBasis } from "@prisma/client";
import type { LoadedConfig, LoadedLens, LoadedSection } from "@/lib/config/loader";
import { computeLens, isLensProvisional, provisionalLensKeys } from "@/lib/engine/lenses";

const CC = 1;

function makeConfig(): LoadedConfig {
  const lens = (key: string, basis: LensBasis): LoadedLens =>
    ({ key, basis, benchmarks: new Map([[CC, 0.95]]) }) as unknown as LoadedLens;

  return {
    sections: [
      {
        id: CC,
        scoringMode: "SECTION_BINARY",
        critical: true,
        capPerAttribute: false,
        attributeCount: 1,
      } as unknown as LoadedSection,
    ],
    lenses: [
      lens("account", LensBasis.PER_ERROR),
      lens("program", LensBasis.PER_SCORESHEET),
      lens("agent", LensBasis.FAILED_SCORESHEETS),
    ],
  } as unknown as LoadedConfig;
}

describe("provisional lens gating (§5.4, PRD Open Q #1)", () => {
  it("marks only the per_error basis as reconciled", () => {
    expect(isLensProvisional(LensBasis.PER_ERROR)).toBe(false);
    expect(isLensProvisional(LensBasis.PER_SCORESHEET)).toBe(true);
    expect(isLensProvisional(LensBasis.FAILED_SCORESHEETS)).toBe(true);
  });

  it("flags provisional on each lens result", () => {
    const config = makeConfig();
    const [account, program, agent] = config.lenses;
    expect(computeLens(account, config, []).provisional).toBe(false);
    expect(computeLens(program, config, []).provisional).toBe(true);
    expect(computeLens(agent, config, []).provisional).toBe(true);
  });

  it("lists the provisional lens keys for a config", () => {
    expect(provisionalLensKeys(makeConfig())).toEqual(["program", "agent"]);
  });
});
