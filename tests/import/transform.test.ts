import type { LoadedConfig, LoadedSection } from "@/lib/config/loader";
import { ScoringMode } from "@prisma/client";
import { aliasKey, type AliasIndex } from "@/lib/import/reason-match";
import { transformWide } from "@/lib/import/wide-transform";
import type { WideCall } from "@/lib/import/wide";

function section(id: number, code: string, attribute: string, reasons: string[]): LoadedSection {
  const errorReasons = reasons.map((label, i) => ({
    id: id * 100 + i,
    key: `${code}.${attribute}.${label}`.toLowerCase(),
    label,
    orderIndex: i,
    attributeId: id * 10,
    sectionId: id,
    dictionary: null,
  }));
  const attr = {
    id: id * 10,
    label: attribute,
    orderIndex: 0,
    categoryId: id,
    sectionId: id,
    errorReasons,
  };
  return {
    id,
    code,
    label: code,
    orderIndex: id,
    scoringMode: ScoringMode.SECTION_BINARY,
    critical: true,
    capPerAttribute: false,
    rankWeight: 50,
    rankBenchmark: 0.9,
    categories: [{ id, label: "Cat", orderIndex: 0, sectionId: id, attributes: [attr] }],
    attributes: [attr],
    attributeCount: 1,
  };
}

const config: LoadedConfig = {
  id: 1,
  version: 1,
  name: "t",
  isActive: true,
  roundingDecimals: 2,
  paretoCutoff: 0.8,
  newAgentTenureDays: 90,
  trialWindowDays: 90,
  sections: [
    section(1, "CC", "Greeting", ["Incomplete closing"]),
    section(2, "NC", "Voice Tone", ["Sleepy - Not energetic tone"]),
  ],
  lenses: [],
  severities: [],
  trainingBuckets: [],
  sectionById: new Map(),
  errorReasonById: new Map(),
  errorReasonByKey: new Map(),
  lensByKey: new Map(),
};

const meta = (login: string) => ({
  login_id: login,
  agent_name: "Ann",
  call_date: "2025-07-01",
  mobile: `100700${login}`,
  call_type: "X",
  monitoring_type: "Y",
  qa_owner: "qa",
});

const calls: WideCall[] = [
  { rowNumber: 1, meta: meta("120"), flags: [{ sectionCode: "CC", source: "Incomplete closing" }] },
  {
    rowNumber: 2,
    meta: meta("121"),
    flags: [{ sectionCode: "NC", source: "Sleepy/Not energetic tone" }],
  },
  { rowNumber: 3, meta: meta("122"), flags: [] },
];

describe("transformWide", () => {
  it("auto-resolves exact matches, reports the rest as unmapped with a suggestion", () => {
    const t = transformWide(config, calls, new Map());
    expect(t.callCount).toBe(3);
    expect(t.flagCount).toBe(2);

    // Call 1's exact CC match becomes a resolved error row.
    const ccRow = t.rows.find((r) => r.section_code === "CC");
    expect(ccRow).toMatchObject({ attribute: "Greeting", error_reason: "Incomplete closing" });
    expect(ccRow!.eval_id).toMatch(/^w-/);

    // Call 3 (clean) becomes a single blank-error row.
    expect(t.rows.some((r) => r.login_id === "122" && !r.error_reason)).toBe(true);

    // Call 2's "Sleepy/..." doesn't match exactly → unmapped, with the loose suggestion.
    expect(t.unmapped).toHaveLength(1);
    expect(t.unmapped[0]).toMatchObject({
      sectionCode: "NC",
      sample: "Sleepy/Not energetic tone",
      count: 1,
    });
    expect(t.unmapped[0].suggestions[0]).toEqual({
      attribute: "Voice Tone",
      reason: "Sleepy - Not energetic tone",
    });
  });

  it("resolves via a saved alias (nothing unmapped)", () => {
    const aliases: AliasIndex = new Map([
      [
        aliasKey("NC", "Sleepy/Not energetic tone"),
        { attribute: "Voice Tone", reason: "Sleepy - Not energetic tone" },
      ],
    ]);
    const t = transformWide(config, calls, aliases);
    expect(t.unmapped).toHaveLength(0);
    expect(t.rows.find((r) => r.section_code === "NC")).toMatchObject({
      attribute: "Voice Tone",
      error_reason: "Sleepy - Not energetic tone",
    });
  });

  /**
   * The id basis (agent, date, phone, call type, monitoring type, call id) does
   * NOT uniquely identify a call — the same agent can handle the same number
   * twice in a day, and call_id is optional. Such rows must stay separate calls:
   * collapsing them under-counts the import and merges their flags.
   */
  it("keeps rows with a repeated id basis as separate calls", () => {
    const t = transformWide(config, [{ ...calls[0] }, { ...calls[0] }], new Map());
    const ids = [...new Set(t.rows.map((r) => r.eval_id))];
    expect(ids).toHaveLength(2);
    // The first keeps the bare hash, so already-imported ids still match.
    expect(ids[1]).toBe(`${ids[0]}-2`);
    expect(t.repeatedBasis).toBe(1);
  });

  it("is still idempotent: the same file twice yields the same ids", () => {
    const run = () =>
      transformWide(
        config,
        [{ ...calls[0] }, { ...calls[0] }, { ...calls[1] }],
        new Map(),
      ).rows.map((r) => r.eval_id);
    expect(run()).toEqual(run());
  });

  it("stamps the sheet row on every generated row, for error reporting", () => {
    const t = transformWide(config, calls, new Map());
    // rowNumber is the 1-based data row; the header is sheet row 1. Call 2 is
    // absent because its reason is unmapped — it produces no row until mapped.
    expect(t.rows.map((r) => r.__row)).toEqual(["2", "4"]);
  });
});
