import type {
  LoadedConfig,
  LoadedErrorReason,
  LoadedLens,
  LoadedSection,
} from "@/lib/config/loader";
import { scoreCall } from "@/lib/engine/score";
import { computeTrend, periodKey, type DatedCall } from "@/lib/engine/trend";

const CC = 1;
const CC_ERR = 10;

function makeConfig(): LoadedConfig {
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
      {
        key: "account",
        basis: "PER_ERROR",
        benchmarks: new Map([[CC, 0.99]]),
      } as unknown as LoadedLens,
    ],
    errorReasonById: new Map<number, LoadedErrorReason>([
      [CC_ERR, { id: CC_ERR, sectionId: CC, attributeId: 100 } as unknown as LoadedErrorReason],
    ]),
  } as unknown as LoadedConfig;
}

describe("period keys (§5.5)", () => {
  it("buckets a date by month, quarter, and week-of-month", () => {
    const d = (s: string) => new Date(s);
    expect(periodKey(d("2025-07-15T00:00:00Z"), "month")).toBe("2025-07");
    expect(periodKey(d("2025-07-15T00:00:00Z"), "quarter")).toBe("2025-Q3");
    expect(periodKey(d("2025-07-03T00:00:00Z"), "week")).toBe("2025-07-W1");
    expect(periodKey(d("2025-07-10T00:00:00Z"), "week")).toBe("2025-07-W2");
    expect(periodKey(d("2025-07-29T00:00:00Z"), "week")).toBe("2025-07-W4"); // last week absorbs 29–31
  });
});

describe("trend recomputation (§5.5)", () => {
  const config = makeConfig();
  const account = config.lenses[0];
  const dated = (date: string, flags: number[]): DatedCall => ({
    callDate: new Date(date),
    scored: scoreCall(config, flags),
  });

  it("recomputes account accuracy per month, sorted by period", () => {
    const calls = [
      dated("2025-07-05T00:00:00Z", []),
      dated("2025-07-06T00:00:00Z", [CC_ERR]), // 1 error in July
      dated("2025-08-05T00:00:00Z", []),
      dated("2025-08-06T00:00:00Z", []),
      dated("2025-08-07T00:00:00Z", []),
    ];
    const trend = computeTrend(account, config, calls, "month");

    expect(trend.map((p) => p.period)).toEqual(["2025-07", "2025-08"]);
    expect(trend[0].callCount).toBe(2);
    expect(trend[0].lens.sections.get(CC)?.accuracy).toBeCloseTo(1 - 1 / 2, 6); // July: 0.5
    expect(trend[1].lens.sections.get(CC)?.accuracy).toBe(1); // August clean
  });

  it("buckets weekly within a month (W1–W4)", () => {
    const calls = [
      dated("2025-07-02T00:00:00Z", []), // W1
      dated("2025-07-09T00:00:00Z", [CC_ERR]), // W2
      dated("2025-07-16T00:00:00Z", []), // W3
    ];
    const trend = computeTrend(account, config, calls, "week");
    expect(trend.map((p) => p.period)).toEqual(["2025-07-W1", "2025-07-W2", "2025-07-W3"]);
    expect(trend[1].lens.sections.get(CC)?.accuracy).toBe(0); // the W2 call had an error
  });
});
