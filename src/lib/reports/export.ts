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

/** "passing/total" behind an accuracy (accuracy = 1 − numerator/denominator). */
const countLabelFor = (numerator: number, denominator: number): string =>
  denominator > 0 ? `${Math.round(denominator - numerator)}/${Math.round(denominator)}` : "";

/**
 * pdf-lib's standard fonts are WinAnsi (CP1252) and THROW on any character
 * outside it, failing the whole download. Real labels reach the PDF from the
 * config, the agent roster and the filters — a custom date range alone renders
 * as "from → to" — so text is normalised here rather than trusted.
 *
 * CP1252 is Latin-1 (U+00A0–U+00FF) plus a fixed set of typographic characters
 * in the 0x80–0x9F gap; everything else is substituted, and anything left over
 * degrades to "?" so a label can never crash an export. Non-Latin scripts
 * therefore transliterate to "?" — embedding a Unicode font is the fix if that
 * is ever needed.
 */
const CP1252_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
]);

const PDF_SUBS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "⇒": "=>",
  "⇐": "<=",
  "≥": ">=",
  "≤": "<=",
  "≠": "!=",
  "≈": "~",
  Σ: "Sum",
  "✓": "Y",
  "✗": "N",
  "■": "-",
  "┄": "-",
};

export function pdfSafe(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20) out += " ";
    else if (
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0xa0 && code <= 0xff) ||
      CP1252_EXTRA.has(code)
    )
      out += ch;
    else out += PDF_SUBS[ch] ?? "?";
  }
  return out;
}

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

// ---------------------------------------------------------------------------
// Chart data — every chart on the report, as the table behind it. One shared
// definition so the PDF draws, Excel bar-renders and the CSV lists exactly the
// same numbers the screen shows.
// ---------------------------------------------------------------------------

export interface ChartBlock {
  title: string;
  /** What the chart shows, in one line — carried into every format. */
  note: string;
  header: string[];
  rows: string[][];
  /** Header indexes holding a 0–100 percentage (data-bar columns in Excel). */
  percentColumns: number[];
  /** Header indexes holding a 0–100 score that is not a percentage (rank). */
  scoreColumns: number[];
}

export function chartBlocks(
  report: Report,
  sections: SectionMeta[],
  decimals: number,
): ChartBlock[] {
  const num = (v: number | undefined) =>
    v == null || Number.isNaN(v) ? "" : (v * 100).toFixed(decimals);
  const blocks: ChartBlock[] = [];

  blocks.push({
    title: "Section accuracy vs benchmark",
    note: "Accuracy per section against its benchmark; a section passes at accuracy ≥ benchmark.",
    header: ["Section", "Label", "Accuracy %", "Benchmark %", "Status"],
    rows: report.sections.map((s) => [
      s.code,
      s.label,
      num(s.accuracy),
      num(s.benchmark),
      s.status,
    ]),
    percentColumns: [2, 3],
    scoreColumns: [],
  });

  if (report.agentComparison.length > 0) {
    blocks.push({
      title: "Figures per agent",
      note: "Accuracy per section for each agent — the grouped column chart, worst-first.",
      header: ["Agent", ...sections.map((s) => `${s.code} %`), "Mean %"],
      rows: report.agentComparison.map((a) => [
        a.agentName,
        ...sections.map((s) => {
          const cell = a.cells.find((c) => c.sectionId === s.sectionId);
          return num(cell?.accuracy);
        }),
        num(a.meanAccuracy),
      ]),
      percentColumns: sections.map((_, i) => i + 1).concat([sections.length + 1]),
      scoreColumns: [],
    });
  }

  if (report.leaderboard.length > 0) {
    blocks.push({
      title: "Leaderboard — agent rank",
      note: "Rank 0–100: each section earns its full weight only when its rank benchmark is met.",
      header: ["Agent", "Rank"],
      rows: report.leaderboard.map((r) => [r.agentName, String(r.rank)]),
      percentColumns: [],
      scoreColumns: [1],
    });
  }

  return blocks;
}

function csvCell(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/**
 * The whole report as ONE csv: the summary, every chart's data, then the raw
 * per-call and per-flag rows. A csv cannot carry a picture, so each chart is
 * written as the table it is drawn from, under its own title — the numbers are
 * identical to the chart on screen.
 */
export function csvDocument(
  report: Report,
  details: CallDetailRow[],
  sections: SectionMeta[],
  meta: ExportMeta,
  decimals: number,
): string {
  const out: string[][] = [];
  const block = (title: string, note: string, rows: string[][]) => {
    if (out.length > 0) out.push([]);
    out.push([`== ${title} ==`]);
    if (note) out.push([note]);
    out.push(...rows);
  };

  block("Report summary", "", summaryRows(report, meta, decimals));
  for (const b of chartBlocks(report, sections, decimals)) {
    block(b.title, b.note, [b.header, ...b.rows]);
  }
  block(
    "Calls",
    "Every scored call behind the figures above.",
    callRows(details, sections, decimals),
  );

  const flags = flagRows(details);
  if (flags.length > 1) block("Flagged reasons", "One row per flagged error.", flags);

  return toCsv(out);
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

  // Charts — each chart's data laid out as a titled block, with native Excel
  // data bars so the columns render in-cell. exceljs cannot create a real chart
  // object, and an embedded picture would need a rasteriser; data bars are
  // native, and Insert ▸ Chart over a block gives a live chart in two clicks.
  const charts = wb.addWorksheet("Charts");
  const SERIES = ["FF2A78D6", "FFEB6834", "FF1BAF7A", "FFEDA100", "FFE87BA4", "FF008300"];
  let at = 1;

  for (const [bi, b] of chartBlocks(report, sections, decimals).entries()) {
    const titleRow = charts.getRow(at);
    titleRow.getCell(1).value = b.title;
    titleRow.getCell(1).font = { bold: true, size: 13 };
    at += 1;

    const noteRow = charts.getRow(at);
    noteRow.getCell(1).value = b.note;
    noteRow.getCell(1).font = { italic: true, size: 9, color: { argb: "FF626976" } };
    at += 1;

    const headerRowIdx = at;
    const header = charts.getRow(at);
    b.header.forEach((h, i) => {
      const c = header.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    });
    at += 1;

    const firstDataRow = at;
    for (const r of b.rows) {
      const row = charts.getRow(at);
      r.forEach((v, i) => {
        const c = row.getCell(i + 1);
        // Numeric columns go in as NUMBERS so the data bars (and any chart the
        // user inserts) read them as values, not text.
        const numeric = b.percentColumns.includes(i) || b.scoreColumns.includes(i);
        if (numeric && v !== "") {
          c.value = Number(v);
          c.numFmt = b.percentColumns.includes(i) ? '0.00"%"' : "0";
        } else {
          c.value = v;
        }
      });
      at += 1;
    }
    const lastDataRow = at - 1;

    if (lastDataRow >= firstDataRow) {
      const colLetter = (i: number) => String.fromCharCode(65 + i);
      for (const ci of [...b.percentColumns, ...b.scoreColumns]) {
        charts.addConditionalFormatting({
          ref: `${colLetter(ci)}${firstDataRow}:${colLetter(ci)}${lastDataRow}`,
          rules: [
            // min/max auto-scaling (Excel's own default): QA accuracy clusters
            // in the 90-100% band, where a fixed 0-100 bar fills every cell and
            // shows nothing. The exact value is printed in the cell regardless.
            // `color` is honoured by exceljs at runtime but missing from its
            // typings, hence the cast.
            {
              type: "dataBar",
              priority: 1,
              gradient: false,
              showValue: true,
              cfvo: [{ type: "min" }, { type: "max" }],
              color: { argb: SERIES[(ci - 1 + bi) % SERIES.length] },
            } as unknown as import("exceljs").DataBarRuleType,
          ],
        });
      }
      charts.views = [{ state: "frozen", ySplit: headerRowIdx }];
    }

    at += 2; // a blank line between blocks
  }

  charts.getColumn(1).width = 34;
  for (let i = 2; i <= 10; i += 1) charts.getColumn(i).width = 14;

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

  /**
   * The ONLY way text reaches the document: every caller goes through
   * `pdfSafe`, so no config label, agent name or filter value can throw a
   * WinAnsi encoding error and fail the download. Reads `page` live, so it
   * always writes to the current page after a break.
   */
  const drawText = (text: string, options: Parameters<typeof page.drawText>[1]) =>
    page.drawText(pdfSafe(text), options);

  const fit = (s: string, width: number, size: number) => {
    const max = Math.max(1, Math.floor(width / (size * 0.52)));
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  };

  const header = () => {
    page.drawRectangle({ x: 0, y: PH - 66, width: PW, height: 66, color: band });
    drawText("Quality Report", {
      x: M,
      y: PH - 38,
      size: 19,
      font: bold,
      color: rgb(1, 1, 1),
    });
    drawText(`${meta.scopeLabel}  ·  ${meta.period}  ·  ${meta.lensLabel} lens`, {
      x: M,
      y: PH - 55,
      size: 10,
      font,
      color: rgb(0.82, 0.85, 0.9),
    });
    drawText(`Generated ${new Date().toISOString().slice(0, 10)}`, {
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
    drawText(value, { x, y: yy, size: 15, font: bold, color: ink });
    drawText(label, { x, y: yy - 13, size: 8, font, color: muted });
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
    drawText(title, { x: M, y: yy, size: 12, font: bold, color: ink });
    yy -= 16;

    const drawRow = (cells: string[], f = font, size = 8.5, fill?: string) => {
      ensure(15);
      if (fill === "head")
        page.drawRectangle({ x: M, y: yy - 3, width: total, height: 15, color: band });
      else if (fill === "zebra")
        page.drawRectangle({ x: M, y: yy - 3, width: total, height: 15, color: zebra });
      let x = M;
      cells.forEach((c, i) => {
        drawText(fit(c, widths[i] - 6, size), {
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

  // --- Charts (drawn as real vectors — no rasteriser, crisp at any zoom) ----
  const SERIES = [
    rgb(0.165, 0.471, 0.839), // #2a78d6
    rgb(0.922, 0.408, 0.204), // #eb6834
    rgb(0.106, 0.686, 0.478), // #1baf7a
    rgb(0.929, 0.631, 0.0), // #eda100
    rgb(0.91, 0.482, 0.643), // #e87ba4
    rgb(0.0, 0.514, 0.0), // #008300
  ];

  /**
   * Grouped column chart: a group per agent, a coloured column per section.
   * The value axis starts at 50% for the same reason the screen chart does —
   * QA accuracy clusters near the top, where a 0-based axis flattens every
   * column — and drops to 0 if anything falls below, so nothing is clipped.
   */
  const drawGroupedChart = (
    title: string,
    groups: { label: string; values: (number | undefined)[] }[],
    seriesLabels: string[],
  ) => {
    if (groups.length === 0 || seriesLabels.length === 0) return;

    const plotW = PW - 2 * M;
    const plotH = 150;
    const axisW = 30;
    const legendH = 16;
    const total = plotH + legendH + 46;
    ensure(total);

    drawText(title, { x: M, y: yy, size: 12, font: bold, color: ink });
    yy -= 14;

    const values = groups
      .flatMap((g) => g.values)
      .filter((v): v is number => v != null && !Number.isNaN(v));
    const min = values.length > 0 ? Math.min(...values) : 1;
    const floor = min < 0.5 ? 0 : 0.5;
    const span = 1 - floor;

    const baseY = yy - plotH;
    const yOf = (v: number) => baseY + plotH * ((Math.max(v, floor) - floor) / span);
    const innerW = plotW - axisW;
    const groupW = innerW / groups.length;
    const barGap = 1.5;
    const barW = Math.min(20, (groupW - 14) / seriesLabels.length - barGap);

    // Gridlines + axis labels (solid hairlines — dashes read as data).
    for (let t = 0; t <= 5; t += 1) {
      const v = floor + (span * t) / 5;
      const gy = yOf(v);
      page.drawLine({
        start: { x: M + axisW, y: gy },
        end: { x: M + plotW, y: gy },
        thickness: 0.4,
        color: line,
      });
      drawText(`${(v * 100).toFixed(0)}%`, {
        x: M,
        y: gy - 2.5,
        size: 6.5,
        font,
        color: muted,
      });
    }

    groups.forEach((g, gi) => {
      const inner = seriesLabels.length * barW + (seriesLabels.length - 1) * barGap;
      const startX = M + axisW + groupW * gi + (groupW - inner) / 2;
      g.values.forEach((v, si) => {
        if (v == null || Number.isNaN(v)) return;
        const x = startX + si * (barW + barGap);
        const h = Math.max(0.6, yOf(v) - baseY);
        page.drawRectangle({
          x,
          y: baseY,
          width: barW,
          height: h,
          color: SERIES[si % SERIES.length],
        });
        drawText(`${(v * 100).toFixed(1)}%`, {
          x: x + barW / 2 - 9,
          y: baseY + h + 2.5,
          size: 5.5,
          font: bold,
          color: ink,
        });
      });
      drawText(fit(g.label, groupW - 4, 6.5), {
        x: M + axisW + groupW * gi + 2,
        y: baseY - 9,
        size: 6.5,
        font,
        color: ink,
      });
    });

    page.drawLine({
      start: { x: M + axisW, y: baseY },
      end: { x: M + plotW, y: baseY },
      thickness: 0.6,
      color: rgb(0.76, 0.77, 0.79),
    });

    // Legend — identity never rests on colour alone.
    let lx = M + axisW;
    seriesLabels.forEach((s, i) => {
      page.drawRectangle({
        x: lx,
        y: baseY - 22,
        width: 6,
        height: 6,
        color: SERIES[i % SERIES.length],
      });
      drawText(s, { x: lx + 9, y: baseY - 21.5, size: 6.5, font, color: muted });
      lx += 9 + s.length * 3.3 + 14;
    });

    yy = baseY - 36;
  };

  /**
   * Single-series column chart, mirroring the on-screen "Section accuracy vs
   * benchmark": one column per section spread evenly across the FULL plot
   * width (not bunched into one cluster like the grouped chart), on a fixed
   * 0–100% axis, coloured by pass/fail with the benchmark marked on each.
   */
  const drawSectionChart = (title: string) => {
    const cols = report.sections;
    if (cols.length === 0) return;

    const plotW = PW - 2 * M;
    const plotH = 150;
    const axisW = 30;
    ensure(plotH + 52);

    drawText(title, { x: M, y: yy, size: 12, font: bold, color: ink });
    yy -= 14;

    const baseY = yy - plotH;
    const yOf = (v: number) => baseY + plotH * Math.max(0, Math.min(1, v)); // fixed 0–100%
    const innerW = plotW - axisW;
    const bandW = innerW / cols.length;
    // Wide columns, evenly spaced — the chart fills the page width.
    const barW = Math.min(64, bandW * 0.5);

    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      page.drawLine({
        start: { x: M + axisW, y: yOf(t) },
        end: { x: M + plotW, y: yOf(t) },
        thickness: 0.4,
        color: line,
      });
      drawText(`${t * 100}%`, { x: M, y: yOf(t) - 2.5, size: 6.5, font, color: muted });
    }

    cols.forEach((s, i) => {
      const cx = M + axisW + bandW * i + bandW / 2;
      const acc = Number.isNaN(s.accuracy) ? 0 : s.accuracy;
      const h = Math.max(0.6, yOf(acc) - baseY);
      const colour =
        s.status === "pass"
          ? rgb(0.071, 0.588, 0.353)
          : s.status === "fail"
            ? rgb(0.863, 0.169, 0.231)
            : rgb(0.6, 0.63, 0.67);

      if (!Number.isNaN(s.accuracy)) {
        page.drawRectangle({ x: cx - barW / 2, y: baseY, width: barW, height: h, color: colour });
      }
      if (s.benchmark != null) {
        page.drawLine({
          start: { x: cx - barW / 2 - 5, y: yOf(s.benchmark) },
          end: { x: cx + barW / 2 + 5, y: yOf(s.benchmark) },
          thickness: 1.1,
          color: ink,
        });
      }
      drawText(Number.isNaN(s.accuracy) ? "n/a" : `${(s.accuracy * 100).toFixed(decimals)}%`, {
        x: cx - 13,
        y: baseY + h + 3,
        size: 7.5,
        font: bold,
        color: ink,
      });
      drawText(s.code, {
        x: cx - s.code.length * 2,
        y: baseY - 10,
        size: 7.5,
        font,
        color: ink,
      });
      const frac = countLabelFor(s.numerator, s.denominator);
      if (frac) {
        drawText(frac, {
          x: cx - frac.length * 1.6,
          y: baseY - 18,
          size: 6,
          font,
          color: muted,
        });
      }
    });

    page.drawLine({
      start: { x: M + axisW, y: baseY },
      end: { x: M + plotW, y: baseY },
      thickness: 0.6,
      color: rgb(0.76, 0.77, 0.79),
    });
    drawText("— benchmark", { x: M + axisW, y: baseY - 30, size: 6.5, font, color: muted });

    yy = baseY - 42;
  };

  drawSectionChart("Section accuracy vs benchmark");

  if (report.agentComparison.length > 0) {
    drawGroupedChart(
      "Figures per agent",
      report.agentComparison.map((a) => ({
        label: a.agentName,
        values: sections.map((s) => a.cells.find((c) => c.sectionId === s.sectionId)?.accuracy),
      })),
      sections.map((s) => s.code),
    );
  }

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
