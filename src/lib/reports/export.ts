import type { CallDetailRow } from "./detail";
import type { Report } from "./metrics";

/**
 * Report export (FR-43). Pure row builders shared by CSV / Excel / PDF so the
 * formats can never disagree; each row is exactly what a chart shows, plus the
 * FULL raw data behind the report (every call + every flagged line). Behind
 * `reports.export` at the route.
 */

export interface ExportMeta {
  scopeLabel: string;
  period: string;
  lensLabel: string;
}

type SectionMeta = { sectionId: number; code: string };

const pctStr = (v: number | undefined, decimals: number) =>
  v == null || Number.isNaN(v) ? "" : (v * 100).toFixed(decimals);
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Section metrics as a table (`""` for n/a — clean in a spreadsheet). */
export function sectionRows(report: Report, decimals: number): string[][] {
  const header = ["Section", "Label", "Accuracy %", "Benchmark %", "Status", "Delta (pts)"];
  const rows = report.sections.map((s) => [
    s.code,
    s.label,
    pctStr(s.accuracy, decimals),
    pctStr(s.benchmark, decimals),
    s.status,
    s.delta == null ? "" : (s.delta * 100).toFixed(decimals),
  ]);
  return [header, ...rows];
}

/** Agent × section accuracy + mean + rank (worst-first order). */
export function agentRows(report: Report, sections: SectionMeta[], decimals: number): string[][] {
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

/** Raw per-call rows — one line per scored call (the full data behind every chart). */
export function callRows(
  details: CallDetailRow[],
  sections: SectionMeta[],
  decimals: number,
): string[][] {
  const header = [
    "Call date",
    "Agent",
    "Login ID",
    "Phone Number",
    "Call type",
    ...sections.map((s) => `${s.code} %`),
    "Result",
    "Flags",
  ];
  const rows = details.map((d) => [
    day(d.callDate),
    d.agentName,
    String(d.agentLoginId),
    d.phoneMasked ?? "",
    d.callType ?? "",
    ...d.sections.map((sc) => pctStr(sc.accuracy, decimals)),
    d.failedScorecard ? "Fail" : "Pass",
    String(d.flags.length),
  ]);
  return [header, ...rows];
}

/** Raw per-flag rows — one line per flagged error across all calls. */
export function flagRows(details: CallDetailRow[]): string[][] {
  const header = ["Call date", "Agent", "Login ID", "Section", "Attribute", "Error reason"];
  const rows = details.flatMap((d) =>
    d.flags.map((f) => [
      day(d.callDate),
      d.agentName,
      String(d.agentLoginId),
      f.sectionCode,
      f.attribute,
      f.reason,
    ]),
  );
  return [header, ...rows];
}

export function summaryRows(report: Report, meta: ExportMeta, decimals: number): string[][] {
  return [
    ["Scope", meta.scopeLabel],
    ["Period", meta.period],
    ["Lens", meta.lensLabel],
    ["Calls scored", String(report.kpis.callCount)],
    ["Agents", String(report.kpis.agentCount)],
    ["Pass rate %", pctStr(report.kpis.passRate, decimals)],
  ];
}

function csvCell(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

// ---------------------------------------------------------------------------
// Excel — a styled, multi-sheet workbook (Summary / Sections / Agents / Calls /
// Flagged reasons). exceljs is imported lazily (Node-only) so the pure row
// builders above stay bundler-safe.
// ---------------------------------------------------------------------------
export async function toXlsx(
  report: Report,
  details: CallDetailRow[],
  sections: SectionMeta[],
  meta: ExportMeta,
  decimals: number,
): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "CC-Quality";
  wb.created = new Date();

  type Ws = import("exceljs").Worksheet;

  const styleHeader = (ws: Ws) => {
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
      c.alignment = { vertical: "middle" };
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: true }, (c) => {
        const len = String(c.value ?? "").length;
        if (len > max) max = len;
      });
      col.width = Math.min(60, max + 2);
    });
  };

  const sheet = (name: string, rows: string[][], style = true) => {
    const ws = wb.addWorksheet(name);
    rows.forEach((r) => ws.addRow(r));
    if (style && rows.length > 0) styleHeader(ws);
    return ws;
  };

  // Summary is key/value (no header band); the rest are styled tables.
  const summary = wb.addWorksheet("Summary");
  summaryRows(report, meta, decimals).forEach((r) => summary.addRow(r));
  summary.getColumn(1).font = { bold: true };
  summary.getColumn(1).width = 16;
  summary.getColumn(2).width = 40;

  sheet("Sections", sectionRows(report, decimals));
  sheet("Agents", agentRows(report, sections, decimals));
  sheet("Calls", callRows(details, sections, decimals));
  sheet("Flagged reasons", flagRows(details));

  return new Uint8Array(await wb.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------------
// PDF — a server-generated, professional report via pdf-lib (no headless
// browser). Cover band + KPI summary + Sections / Agents / Calls tables +
// flagged-reason list, all auto-paginated.
// ---------------------------------------------------------------------------
export async function toPdf(
  report: Report,
  details: CallDetailRow[],
  sections: SectionMeta[],
  meta: ExportMeta,
  decimals: number,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PW = 595.28;
  const PH = 841.89;
  const M = 40;
  const ink = rgb(0.1, 0.12, 0.16);
  const muted = rgb(0.45, 0.48, 0.52);
  const line = rgb(0.85, 0.86, 0.88);
  const band = rgb(0.12, 0.16, 0.22);
  const zebra = rgb(0.955, 0.96, 0.965);

  let page = doc.addPage([PW, PH]);
  let yy = PH;

  const fit = (s: string, width: number, size: number) => {
    const max = Math.max(1, Math.floor(width / (size * 0.52)));
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  };

  const header = () => {
    page.drawRectangle({ x: 0, y: PH - 66, width: PW, height: 66, color: band });
    page.drawText("Quality Report", {
      x: M,
      y: PH - 38,
      size: 19,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText(`${meta.scopeLabel}  ·  ${meta.period}  ·  ${meta.lensLabel} lens`, {
      x: M,
      y: PH - 55,
      size: 10,
      font,
      color: rgb(0.82, 0.85, 0.9),
    });
    page.drawText(`Generated ${new Date().toISOString().slice(0, 10)}`, {
      x: PW - M - 140,
      y: PH - 55,
      size: 9,
      font,
      color: rgb(0.82, 0.85, 0.9),
    });
    yy = PH - 66 - 24;
  };

  const newPage = () => {
    page = doc.addPage([PW, PH]);
    yy = PH - M;
  };
  const ensure = (h: number) => {
    if (yy - h < M) newPage();
  };

  header();

  // KPI summary
  const k = report.kpis;
  const stat = (label: string, value: string, x: number) => {
    page.drawText(value, { x, y: yy, size: 15, font: bold, color: ink });
    page.drawText(label, { x, y: yy - 13, size: 8, font, color: muted });
  };
  stat("Calls scored", String(k.callCount), M);
  stat("Agents", String(k.agentCount), M + 150);
  stat(
    "Pass rate",
    Number.isNaN(k.passRate)
      ? "n/a"
      : `${(k.passRate * 100).toFixed(decimals)}% (${k.passCount}/${k.callCount})`,
    M + 270,
  );
  yy -= 42;

  const drawTable = (title: string, headers: string[], rows: string[][], widths: number[]) => {
    const total = widths.reduce((a, b) => a + b, 0);
    ensure(46);
    page.drawText(title, { x: M, y: yy, size: 12, font: bold, color: ink });
    yy -= 16;

    const drawRow = (cells: string[], f = font, size = 8.5, fill?: string) => {
      ensure(15);
      if (fill === "head")
        page.drawRectangle({ x: M, y: yy - 3, width: total, height: 15, color: band });
      else if (fill === "zebra")
        page.drawRectangle({ x: M, y: yy - 3, width: total, height: 15, color: zebra });
      let x = M;
      cells.forEach((c, i) => {
        page.drawText(fit(c, widths[i] - 6, size), {
          x: x + 3,
          y: yy,
          size,
          font: f,
          color: fill === "head" ? rgb(1, 1, 1) : ink,
        });
        x += widths[i];
      });
      yy -= 15;
      page.drawLine({
        start: { x: M, y: yy + 12 },
        end: { x: M + total, y: yy + 12 },
        thickness: 0.4,
        color: line,
      });
    };

    drawRow(headers, bold, 8.5, "head");
    rows.forEach((r, i) => drawRow(r, font, 8.5, i % 2 === 1 ? "zebra" : undefined));
    yy -= 12;
  };

  drawTable(
    "Sections",
    ["Code", "Section", "Accuracy", "Benchmark", "Status"],
    report.sections.map((s) => [
      s.code,
      s.label,
      pctStr(s.accuracy, decimals) ? `${pctStr(s.accuracy, decimals)}%` : "n/a",
      pctStr(s.benchmark, decimals) ? `${pctStr(s.benchmark, decimals)}%` : "—",
      s.status,
    ]),
    [50, 205, 70, 70, 60],
  );

  drawTable(
    "Agents",
    ["Agent", ...sections.map((s) => s.code), "Mean", "Rank"],
    agentRows(report, sections, decimals).slice(1),
    [150, ...sections.map(() => Math.min(60, 240 / sections.length)), 55, 50],
  );

  const callWidths = [
    62,
    106,
    66,
    66,
    ...sections.map(() => Math.min(40, 150 / sections.length)),
    45,
  ];
  drawTable(
    `Calls (${details.length})`,
    ["Date", "Agent", "Phone", "Call type", ...sections.map((s) => s.code), "Result"],
    details.map((d) => [
      day(d.callDate),
      d.agentName,
      d.phoneMasked ?? "—",
      d.callType ?? "—",
      ...d.sections.map((sc) =>
        Number.isNaN(sc.accuracy) ? "n/a" : `${(sc.accuracy * 100).toFixed(0)}%`,
      ),
      d.failedScorecard ? "Fail" : "Pass",
    ]),
    callWidths,
  );

  const flags = flagRows(details).slice(1);
  if (flags.length > 0) {
    drawTable(
      `Flagged reasons (${flags.length})`,
      ["Date", "Agent", "Section", "Attribute", "Error reason"],
      flags.map((f) => [f[0], f[1], f[3], f[4], f[5]]),
      [65, 110, 45, 120, 175],
    );
  }

  return doc.save();
}
