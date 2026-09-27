import { sectionCodeFor } from "./normalize";

/**
 * Raw sheet reading for wide-format import. Unlike the long importer's
 * `parseXlsx` (which keys rows by header and so COLLAPSES the wide file's
 * repeated section columns), this preserves every column by position.
 */

export interface RawSheet {
  header: string[];
  rows: string[][];
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const obj = value as Record<string, unknown>;
  if (typeof obj.text === "string") return obj.text;
  if (Array.isArray(obj.richText)) {
    return obj.richText.map((p) => (p as { text?: string }).text ?? "").join("");
  }
  if (obj.result != null) return String(obj.result);
  return "";
}

/** Read the first worksheet into a positional grid (exceljs is Node-only → lazy). */
export async function readSheetXlsx(buffer: Buffer): Promise<RawSheet> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  if (!ws) return { header: [], rows: [] };

  const header: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, n) => {
    header[n - 1] = cellToString(c.value).trim();
  });

  const rows: string[][] = [];
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const arr: string[] = [];
    let hasValue = false;
    for (let i = 1; i <= header.length; i += 1) {
      const v = cellToString(row.getCell(i).value).trim();
      arr[i - 1] = v;
      if (v !== "") hasValue = true;
    }
    if (hasValue) rows.push(arr);
  }
  return { header, rows };
}

/** RFC-4180-ish CSV into a positional grid (quoted fields, "" escapes, CRLF). */
export function readSheetCsv(text: string): RawSheet {
  const grid: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      grid.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    grid.push(row);
  }
  const header = (grid[0] ?? []).map((h) => h.trim());
  const rows = grid.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  return { header, rows };
}

/**
 * A sheet is "wide" (one row per call, section columns) when it has at least one
 * section-code column and no explicit `error_reason` column (the long marker).
 */
export function isWideFormat(header: string[], configCodes: readonly string[]): boolean {
  if (header.some((h) => h.trim().toLowerCase() === "error_reason")) return false;
  return header.some((h) => sectionCodeFor(h, configCodes) !== null);
}
