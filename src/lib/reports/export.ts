import type { Report } from "./metrics";

/**
 * Report export (FR-43). Pure row builders shared by CSV and Excel so the two
 * formats can never disagree; each row is exactly what a chart shows. Behind
 * `reports.export` at the route.
 */

export interface ExportMeta {
  scopeLabel: string;
  period: string;
  lensLabel: string;
}

/** Section metrics as a table (`""` for n/a — clean in a spreadsheet). */
export function sectionRows(report: Report, decimals: number): string[][] {
  const num = (v: number | undefined) =>
    v == null || Number.isNaN(v) ? "" : (v * 100).toFixed(decimals);
  const header = ["Section", "Label", "Accuracy %", "Benchmark %", "Status", "Delta (pts)"];
  const rows = report.sections.map((s) => [
    s.code,
    s.label,
    num(s.accuracy),
    num(s.benchmark),
    s.status,
    s.delta == null ? "" : (s.delta * 100).toFixed(decimals),
  ]);
  return [header, ...rows];
}

/** Agent × section accuracy + mean + rank (worst-first order). */
export function agentRows(
  report: Report,
  sections: { sectionId: number; code: string }[],
  decimals: number,
): string[][] {
  const num = (v: number) => (Number.isNaN(v) ? "" : (v * 100).toFixed(decimals));
  const rankByLogin = new Map(report.leaderboard.map((r) => [r.loginId, r.rank]));
  const header = ["Agent", ...sections.map((s) => `${s.code} %`), "Mean %", "Rank"];
  const rows = report.agentComparison.map((a) => [
    a.agentName,
    ...a.cells.map((c) => num(c.accuracy)),
    num(a.meanAccuracy),
    String(rankByLogin.get(a.loginId) ?? ""),
  ]);
  return [header, ...rows];
}

export function summaryRows(report: Report, meta: ExportMeta, decimals: number): string[][] {
  const passRate = Number.isNaN(report.kpis.passRate)
    ? ""
    : (report.kpis.passRate * 100).toFixed(decimals);
  return [
    ["Scope", meta.scopeLabel],
    ["Period", meta.period],
    ["Lens", meta.lensLabel],
    ["Calls scored", String(report.kpis.callCount)],
    ["Agents", String(report.kpis.agentCount)],
    ["Pass rate %", passRate],
  ];
}

function csvCell(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/**
 * A multi-sheet workbook: Summary / Sections / Agents. exceljs is imported
 * lazily so the pure row builders above don't pull it in (it's Node-only).
 */
export async function toXlsx(
  report: Report,
  sections: { sectionId: number; code: string }[],
  meta: ExportMeta,
  decimals: number,
): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "CC-Quality";
  wb.created = new Date();

  const summary = wb.addWorksheet("Summary");
  summaryRows(report, meta, decimals).forEach((r) => summary.addRow(r));

  const sec = wb.addWorksheet("Sections");
  sectionRows(report, decimals).forEach((r) => sec.addRow(r));

  const ag = wb.addWorksheet("Agents");
  agentRows(report, sections, decimals).forEach((r) => ag.addRow(r));

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
