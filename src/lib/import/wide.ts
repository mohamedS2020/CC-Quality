import { sectionCodeFor } from "./normalize";
import type { RawSheet } from "./sheet";

/**
 * Wide-format parsing: one spreadsheet row = one call, with repeated section
 * columns (CC / EC×n / BC×n / NC×n) whose non-empty cells hold the flagged
 * error-reason text. Classify each column, then pivot every row into its
 * metadata + a flat list of (section, source-reason) flags.
 */

export interface WideFlag {
  sectionCode: string;
  source: string;
}

export interface WideCall {
  rowNumber: number; // 1-based data-row index (for eval_id + error messages)
  meta: Record<string, string>; // long-importer metadata keys
  flags: WideFlag[];
}

type Column =
  { kind: "section"; code: string } | { kind: "meta"; field: string } | { kind: "ignore" };

// Ordered so specific headers win (transaction/monitoring before the generic "type").
const META_MATCHERS: [RegExp, string][] = [
  [/login/i, "login_id"],
  [/agent/i, "agent_name"],
  [/\bdate\b/i, "call_date"],
  [/mobile|phone/i, "mobile"],
  [/transaction/i, "transaction_type"],
  [/monitoring/i, "monitoring_type"],
  [/call\s*type|\btype\b/i, "call_type"],
  [/owner|\bqa\b/i, "qa_owner"],
  [/call\s*id/i, "call_id"],
];

function classify(header: string[], configCodes: readonly string[]): Column[] {
  return header.map((h) => {
    const code = sectionCodeFor(h, configCodes);
    if (code) return { kind: "section", code };
    for (const [re, field] of META_MATCHERS) {
      if (re.test(h)) return { kind: "meta", field };
    }
    return { kind: "ignore" };
  });
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/** Normalise a source date cell to YYYY-MM-DD (ISO, "Www Mmm DD YYYY", or parseable). */
export function parseWideDate(raw: string): string {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const named = t.match(/(\w{3})\s+(\d{1,2})\s+(\d{4})/);
  if (named && MONTHS[named[1].toLowerCase()]) {
    return `${named[3]}-${MONTHS[named[1].toLowerCase()]}-${named[2].padStart(2, "0")}`;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime())
    ? ""
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Pivot a wide sheet into per-call metadata + section/source flags. */
export function parseWide(sheet: RawSheet, configCodes: readonly string[]): WideCall[] {
  const cols = classify(sheet.header, configCodes);

  return sheet.rows.map((cells, index) => {
    const meta: Record<string, string> = {};
    const flags: WideFlag[] = [];

    cols.forEach((col, i) => {
      const value = (cells[i] ?? "").trim();
      if (col.kind === "meta") {
        if (value && !meta[col.field]) meta[col.field] = value;
      } else if (col.kind === "section" && value) {
        flags.push({ sectionCode: col.code, source: value });
      }
    });

    if (meta.call_date) meta.call_date = parseWideDate(meta.call_date);

    return { rowNumber: index + 1, meta, flags };
  });
}
