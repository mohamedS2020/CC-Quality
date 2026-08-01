import type {
  LoadedAttribute,
  LoadedConfig,
  LoadedErrorReason,
  LoadedSection,
} from "@/lib/config/loader";
import { computeErrorAnalytics } from "@/lib/engine/analytics";

const NC = 4;
// Attribute ids under NC.
const CONTROLS = 100;
const PROF = 300;
const GREETING = 400;
const VOICE = 600;

function makeConfig(): LoadedConfig {
  const attribute = (id: number, label: string): LoadedAttribute =>
    ({ id, label, sectionId: NC }) as unknown as LoadedAttribute;

  const section = {
    id: NC,
    attributes: [
      attribute(CONTROLS, "Controls the call well"),
      attribute(PROF, "Professional personalization"),
      attribute(GREETING, "Uses appropriate Greeting/Closing"),
      attribute(VOICE, "Voice Tone"),
    ],
  } as unknown as LoadedSection;

  const reason = (
    id: number,
    attributeId: number,
    trainingBucket: string | null = null,
  ): LoadedErrorReason =>
    ({
      id,
      attributeId,
      sectionId: NC,
      label: `reason-${id}`,
      dictionary: trainingBucket ? { trainingBucket } : null,
    }) as unknown as LoadedErrorReason;

  const reasons = [
    reason(1, CONTROLS),
    reason(2, PROF),
    reason(3, GREETING, "Telephone etiquette"),
    reason(4, VOICE),
  ];

  return {
    sections: [section],
    errorReasonById: new Map(reasons.map((r) => [r.id, r])),
  } as unknown as LoadedConfig;
}

// §5.7 NC month tally: Controls 18, Greeting 7, Voice 6, Prof 1 → 32 total.
const flags = [
  ...Array<number>(18).fill(1),
  ...Array<number>(7).fill(3),
  ...Array<number>(6).fill(4),
  ...Array<number>(1).fill(2),
];

describe("error analytics — Pareto (§5.7)", () => {
  const analytics = computeErrorAnalytics(makeConfig(), flags);

  it("counts errors per section, attribute, and reason", () => {
    expect(analytics.totalErrors).toBe(32);
    expect(analytics.sectionCounts.get(NC)).toBe(32);
    expect(analytics.attributeCounts.get(CONTROLS)).toBe(18);
    expect(analytics.reasonCounts.get(1)).toBe(18);
  });

  it("ranks attributes and reproduces the verified shares", () => {
    const pareto = analytics.attributePareto;
    expect(pareto.map((p) => p.label)).toEqual([
      "Controls the call well",
      "Uses appropriate Greeting/Closing",
      "Voice Tone",
      "Professional personalization",
    ]);
    expect(pareto[0].shareInSection).toBeCloseTo(18 / 32, 6); // 56.25%
    expect(pareto[1].shareInSection).toBeCloseTo(7 / 32, 6); // 21.875%
    expect(pareto[2].shareInSection).toBeCloseTo(6 / 32, 6); // 18.75%
    expect(pareto[3].shareInSection).toBeCloseTo(1 / 32, 6); // 3.125%
  });
});

describe("training-bucket aggregation (§9)", () => {
  it("sums errors into their training bucket, skipping unassigned reasons", () => {
    const analytics = computeErrorAnalytics(makeConfig(), flags);
    // Only reason 3 (Greeting) has a bucket, flagged 7 times.
    expect(analytics.trainingBucketCounts.get("Telephone etiquette")).toBe(7);
    expect(analytics.trainingBucketCounts.size).toBe(1);
  });
});
