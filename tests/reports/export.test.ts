/**
 * Report export (task 9.8, FR-43): the shared row builders produce exactly what
 * the charts show, so CSV and Excel can never disagree. Pure — a hand-built
 * Report literal.
 */
import {
  agentRows,
  callRows,
  chartBlocks,
  csvDocument,
  flagRows,
  pdfSafe,
  sectionRows,
  summaryRows,
  toCsv,
  toPdf,
} from "@/lib/reports/export";
import type { Report } from "@/lib/reports/metrics";
import type { CallDetailRow } from "@/lib/reports/detail";

const report: Report = {
  sections: [
    {
      sectionId: 1,
      code: "CC",
      label: "Call Compliance",
      accuracy: 0.9867,
      numerator: 2,
      denominator: 150,
      benchmark: 0.95,
      status: "pass",
      delta: 0.004,
    },
    {
      sectionId: 2,
      code: "NC",
      label: "Non Critical",
      accuracy: 0.9289,
      numerator: 64,
      denominator: 900,
      benchmark: 0.95,
      status: "fail",
      delta: -0.021,
    },
  ],
  agentComparison: [
    {
      loginId: 2,
      agentName: "Bo",
      cells: [
        { sectionId: 1, accuracy: 1, numerator: 0, denominator: 2, status: "pass" },
        { sectionId: 2, accuracy: 1, numerator: 0, denominator: 12, status: "pass" },
      ],
      meanAccuracy: 1,
    },
    {
      loginId: 1,
      agentName: "Ann",
      cells: [
        { sectionId: 1, accuracy: 0.5, numerator: 1, denominator: 2, status: "fail" },
        { sectionId: 2, accuracy: 1, numerator: 0, denominator: 12, status: "pass" },
      ],
      meanAccuracy: 0.75,
    },
  ],
  leaderboard: [
    { loginId: 2, agentName: "Bo", rank: 100 },
    { loginId: 1, agentName: "Ann", rank: 40 },
  ],
  kpis: { callCount: 3, agentCount: 2, passCount: 2, passRate: 2 / 3, passRateDelta: -1 / 3 },
  lensKey: "account",
  lensProvisional: false,
  unresolvedFlags: 0,
};

const sectionMeta = [
  { sectionId: 1, code: "CC" },
  { sectionId: 2, code: "NC" },
];

describe("report export rows", () => {
  it("builds section rows (accuracy, benchmark, status, delta pts)", () => {
    expect(sectionRows(report, 2)).toEqual([
      ["Section", "Label", "Accuracy %", "Benchmark %", "Status", "Delta (pts)"],
      ["CC", "Call Compliance", "98.67", "95.00", "pass", "0.40"],
      ["NC", "Non Critical", "92.89", "95.00", "fail", "-2.10"],
    ]);
  });

  it("builds agent rows (section columns + mean + rank), worst-first order", () => {
    expect(agentRows(report, sectionMeta, 2)).toEqual([
      ["Agent", "CC %", "NC %", "Mean %", "Rank"],
      ["Bo", "100.00", "100.00", "100.00", "100"],
      ["Ann", "50.00", "100.00", "75.00", "40"],
    ]);
  });

  it("builds a summary block", () => {
    expect(
      summaryRows(
        report,
        { scopeLabel: "Whole account", period: "2026-07", lensLabel: "Account" },
        2,
      ),
    ).toEqual([
      ["Scope", "Whole account"],
      ["Period", "2026-07"],
      ["Lens", "Account"],
      ["Calls scored", "3"],
      ["Agents", "2"],
      ["Pass rate %", "66.67"],
    ]);
  });

  const details: CallDetailRow[] = [
    {
      evalId: "c1",
      agentLoginId: 1,
      agentName: "Ann",
      callDate: new Date("2026-07-01T00:00:00Z"),
      callType: "Inbound",
      phoneMasked: "******5658",
      failedScorecard: true,
      reasonIds: [10],
      sections: [
        { sectionId: 1, code: "CC", accuracy: 0, errorCount: 1 },
        { sectionId: 2, code: "NC", accuracy: 1, errorCount: 0 },
      ],
      flags: [{ sectionCode: "CC", attribute: "Verification", reason: "Skipped verification" }],
    },
    {
      evalId: "c2",
      agentLoginId: 2,
      agentName: "Bo",
      callDate: new Date("2026-07-02T00:00:00Z"),
      callType: null,
      phoneMasked: null,
      failedScorecard: false,
      reasonIds: [],
      sections: [
        { sectionId: 1, code: "CC", accuracy: 1, errorCount: 0 },
        { sectionId: 2, code: "NC", accuracy: 1, errorCount: 0 },
      ],
      flags: [],
    },
  ];

  it("builds raw per-call rows (per-section accuracy, result, flag count)", () => {
    expect(callRows(details, sectionMeta, 2)).toEqual([
      [
        "Call date",
        "Agent",
        "Login ID",
        "Phone Number",
        "Call type",
        "CC %",
        "NC %",
        "Result",
        "Flags",
      ],
      ["2026-07-01", "Ann", "1", "******5658", "Inbound", "0.00", "100.00", "Fail", "1"],
      ["2026-07-02", "Bo", "2", "", "", "100.00", "100.00", "Pass", "0"],
    ]);
  });

  it("builds one raw row per flagged error", () => {
    expect(flagRows(details)).toEqual([
      ["Call date", "Agent", "Login ID", "Section", "Attribute", "Error reason"],
      ["2026-07-01", "Ann", "1", "CC", "Verification", "Skipped verification"],
    ]);
  });

  it("serializes CSV with quoting for commas and quotes", () => {
    const csv = toCsv([
      ["a", "b,c", 'has "quote"'],
      ["1", "2", "3"],
    ]);
    expect(csv).toBe('a,"b,c","has ""quote"""\r\n1,2,3');
  });
});

/**
 * Charts in the exports: a csv/xlsx cannot hold a picture, so every chart ships
 * as the table it is drawn from. These assert the tables carry the SAME numbers
 * the chart shows, and that the numeric columns are flagged for Excel's data bars.
 */
describe("chart blocks", () => {
  it("covers every chart on the report", () => {
    const titles = chartBlocks(report, sectionMeta, 2).map((b) => b.title);
    expect(titles).toEqual([
      "Section accuracy vs benchmark",
      "Figures per agent",
      "Leaderboard — agent rank",
    ]);
  });

  it("matches the per-agent chart to the agent table, section by section", () => {
    const figures = chartBlocks(report, sectionMeta, 2).find(
      (b) => b.title === "Figures per agent",
    );
    const fromTable = agentRows(report, sectionMeta, 2).slice(1);

    expect(figures!.header).toEqual(["Agent", "CC %", "NC %", "Mean %"]);
    figures!.rows.forEach((row, i) => {
      // agentRows is [agent, ...sections, mean, rank]; the chart block drops rank.
      expect(row).toEqual(fromTable[i].slice(0, -1));
    });
  });

  it("marks the numeric columns so Excel can bar-render them", () => {
    const [sectionsBlock, figures, leaderboard] = chartBlocks(report, sectionMeta, 2);
    expect(sectionsBlock.percentColumns).toEqual([2, 3]); // accuracy + benchmark
    expect(figures.percentColumns).toEqual([1, 2, 3]); // CC, NC, Mean
    expect(leaderboard.scoreColumns).toEqual([1]); // rank is 0–100, not a %
    // A label column is never bar-rendered.
    for (const b of [sectionsBlock, figures, leaderboard]) {
      expect([...b.percentColumns, ...b.scoreColumns]).not.toContain(0);
    }
  });

  it("omits agent blocks when the report has no agents", () => {
    const empty = { ...report, agentComparison: [], leaderboard: [] };
    expect(chartBlocks(empty, sectionMeta, 2).map((b) => b.title)).toEqual([
      "Section accuracy vs benchmark",
    ]);
  });
});

/**
 * REGRESSION: pdf-lib's standard fonts are WinAnsi and THROW on anything
 * outside CP1252. A custom From/To range labels the window "from → to", which
 * failed the whole PDF download; config labels and agent names are equally
 * uncontrolled, so the guard has to cover the class, not just the arrow.
 */
describe("pdfSafe", () => {
  it("substitutes the characters this app actually generates", () => {
    expect(pdfSafe("2026-01-05 → 2026-06-15")).toBe("2026-01-05 -> 2026-06-15");
    expect(pdfSafe("accuracy ≥ benchmark")).toBe("accuracy >= benchmark");
    expect(pdfSafe("any error ⇒ 0")).toBe("any error => 0");
  });

  it("keeps everything WinAnsi can already encode", () => {
    // Latin-1 accents, CP1252 typography, and the middle dot the header uses.
    const keep = "Whole account · 2026-09 — Ahmed “Ayman” · café – naïve … 100%";
    expect(pdfSafe(keep)).toBe(keep);
  });

  it("degrades anything else to ? instead of throwing", () => {
    expect(pdfSafe("محمد")).toBe("????");
    expect(pdfSafe("名前")).toBe("??");
    expect(pdfSafe("a\tb\nc")).toBe("a b c");
  });

  it("builds the PDF for a custom date range and a non-Latin name", async () => {
    // The exact shape that failed: resolveWindow labels a range "from → to",
    // which the header draws verbatim.
    const bytes = await toPdf(
      report,
      [],
      sectionMeta,
      { scopeLabel: "Agent محمد", period: "2026-01-05 → 2026-06-15", lensLabel: "Account" },
      2,
    );
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

describe("csvDocument", () => {
  const details: CallDetailRow[] = [];
  const meta = { scopeLabel: "Whole account", period: "2026-09", lensLabel: "Account" };

  it("carries the summary, every chart, and the raw calls under titled blocks", () => {
    const csv = csvDocument(report, details, sectionMeta, meta, 2);
    const titles = [...csv.matchAll(/^== (.+) ==$/gm)].map((m) => m[1]);
    expect(titles).toEqual([
      "Report summary",
      "Section accuracy vs benchmark",
      "Figures per agent",
      "Leaderboard — agent rank",
      "Calls",
    ]);
  });

  it("writes the same figures the chart shows", () => {
    const csv = csvDocument(report, details, sectionMeta, meta, 2);
    const figures = chartBlocks(report, sectionMeta, 2).find(
      (b) => b.title === "Figures per agent",
    );
    for (const row of figures!.rows) expect(csv).toContain(toCsv([row]));
  });

  // The other two formats are UTF-8 and must NOT need the PDF's substitution.
  it("keeps the range label intact — csv is UTF-8, not WinAnsi", () => {
    const ranged = { ...meta, period: "2026-01-05 → 2026-06-15" };
    expect(csvDocument(report, [], sectionMeta, ranged, 2)).toContain("2026-01-05 → 2026-06-15");
  });
});
