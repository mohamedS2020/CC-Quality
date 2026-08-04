/**
 * Report export (task 9.8, FR-43): the shared row builders produce exactly what
 * the charts show, so CSV and Excel can never disagree. Pure — a hand-built
 * Report literal.
 */
import { agentRows, sectionRows, summaryRows, toCsv } from "@/lib/reports/export";
import type { Report } from "@/lib/reports/metrics";

const report: Report = {
  sections: [
    {
      sectionId: 1,
      code: "CC",
      label: "Call Compliance",
      accuracy: 0.9867,
      benchmark: 0.95,
      status: "pass",
      delta: 0.004,
    },
    {
      sectionId: 2,
      code: "NC",
      label: "Non Critical",
      accuracy: 0.9289,
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
        { sectionId: 1, accuracy: 1, status: "pass" },
        { sectionId: 2, accuracy: 1, status: "pass" },
      ],
      meanAccuracy: 1,
    },
    {
      loginId: 1,
      agentName: "Ann",
      cells: [
        { sectionId: 1, accuracy: 0.5, status: "fail" },
        { sectionId: 2, accuracy: 1, status: "pass" },
      ],
      meanAccuracy: 0.75,
    },
  ],
  leaderboard: [
    { loginId: 2, agentName: "Bo", rank: 100 },
    { loginId: 1, agentName: "Ann", rank: 40 },
  ],
  kpis: { callCount: 3, agentCount: 2, passRate: 2 / 3, passRateDelta: -1 / 3 },
  lensKey: "account",
  lensProvisional: false,
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

  it("serializes CSV with quoting for commas and quotes", () => {
    const csv = toCsv([
      ["a", "b,c", 'has "quote"'],
      ["1", "2", "3"],
    ]);
    expect(csv).toBe('a,"b,c","has ""quote"""\r\n1,2,3');
  });
});
