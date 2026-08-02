import ExcelJS from "exceljs";
import type { Agent } from "@prisma/client";
import type { LoadedConfig } from "@/lib/config/loader";
import { prisma } from "@/lib/db/client";
import type { AgentResolver } from "@/lib/agents/normalize";
import { createEvaluation, type CreateEvaluationInput } from "./create";

/**
 * Bulk importer (FR-17). Parses a CSV in the "one row per flagged error, call
 * metadata repeated, grouped by eval_id" shape, resolves the agent (by login_id
 * or name via the Data Standard) and each error reason against the config, then
 * runs the SAME `createEvaluation` engine derivation as manual entry — so an
 * imported row and a typed row are identical. Duplicate eval_ids are skipped, so
 * re-importing is idempotent.
 */

export interface ImportError {
  evalId: string;
  message: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: ImportError[];
}

// ---------------------------------------------------------------------------
// CSV parsing (RFC-4180-ish: quoted fields, "" escapes, CRLF).
// ---------------------------------------------------------------------------
function tokenize(text: string): string[][] {
  const rows: string[][] = [];
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
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows = tokenize(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((cells) => cells.some((c) => c.trim() !== ""))
    .map((cells) => {
      const record: Record<string, string> = {};
      header.forEach((h, i) => {
        record[h] = (cells[i] ?? "").trim();
      });
      return record;
    });
}

// ---------------------------------------------------------------------------
// Excel (.xlsx): read the first worksheet into the SAME row shape as parseCsv,
// so both formats feed the identical import pipeline.
// ---------------------------------------------------------------------------
function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const obj = value as unknown as Record<string, unknown>;
  if (typeof obj.text === "string") return obj.text; // hyperlink cell
  if (Array.isArray(obj.richText)) {
    return obj.richText.map((part) => (part as { text?: string }).text ?? "").join("");
  }
  if (obj.result != null) return String(obj.result); // formula result
  return "";
}

export async function parseXlsx(buffer: Buffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  // Cast bridges a @types/node vs exceljs Buffer-generic mismatch (runtime is fine).
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const header: string[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    header[colNumber - 1] = cellToString(cell.value).trim();
  });
  if (header.length === 0) return [];

  const records: Record<string, string>[] = [];
  for (let r = 2; r <= worksheet.rowCount; r += 1) {
    const row = worksheet.getRow(r);
    const record: Record<string, string> = {};
    let hasValue = false;
    header.forEach((key, i) => {
      if (!key) return;
      const value = cellToString(row.getCell(i + 1).value).trim();
      if (value !== "") hasValue = true;
      record[key] = value;
    });
    if (hasValue) records.push(record);
  }
  return records;
}

// ---------------------------------------------------------------------------
// Reason resolution: (section code, attribute, reason) → error reason id.
// The full path disambiguates labels that repeat across sections/attributes.
// ---------------------------------------------------------------------------
function reasonKey(sectionCode: string, attribute: string, reason: string): string {
  return [sectionCode, attribute, reason].map((s) => s.trim().toLowerCase()).join("|");
}

export function buildReasonIndex(config: LoadedConfig): Map<string, number> {
  const index = new Map<string, number>();
  for (const section of config.sections) {
    for (const category of section.categories) {
      for (const attribute of category.attributes) {
        for (const reason of attribute.errorReasons) {
          index.set(reasonKey(section.code, attribute.label, reason.label), reason.id);
        }
      }
    }
  }
  return index;
}

function resolveAgent(meta: Record<string, string>, resolver: AgentResolver): Agent | null {
  const loginId = meta.login_id;
  if (loginId && /^\d+$/.test(loginId)) {
    const byId = resolver.resolveByLoginId(Number(loginId));
    if (byId) return byId;
  }
  return meta.agent_name ? resolver.resolve(meta.agent_name) : null;
}

function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

type GroupPlan =
  | { evalId: string; kind: "ready"; input: CreateEvaluationInput }
  | { evalId: string; kind: "duplicate" }
  | { evalId: string; kind: "error"; message: string };

/** Resolve one eval_id group into a ready input, or a validation error (no DB). */
function resolveGroup(
  reasonIndex: Map<string, number>,
  resolver: AgentResolver,
  evalId: string,
  groupRows: Record<string, string>[],
): { ok: true; input: CreateEvaluationInput } | { ok: false; message: string } {
  const meta = groupRows[0];
  const agent = resolveAgent(meta, resolver);
  if (!agent) return { ok: false, message: "unresolvable agent (login_id/name)" };

  const callDate = toDate(meta.call_date);
  if (!callDate) return { ok: false, message: "invalid or missing call_date" };

  const reasonIds: number[] = [];
  for (const row of groupRows) {
    if (!row.error_reason) continue; // a clean-call row
    const id = reasonIndex.get(reasonKey(row.section_code, row.attribute, row.error_reason));
    if (id === undefined) {
      return { ok: false, message: `error reason not in config: "${row.error_reason}"` };
    }
    reasonIds.push(id);
  }

  return {
    ok: true,
    input: {
      evalId,
      agentLoginId: agent.loginId,
      qaOwner: meta.qa_owner || "import",
      callDate,
      callId: meta.call_id || undefined,
      queue: meta.queue || undefined,
      transactionType: meta.transaction_type || undefined,
      monitoringType: meta.monitoring_type || undefined,
      callType: meta.call_type || undefined,
      mobile: meta.mobile || undefined,
      durationSeconds: meta.duration_seconds ? Number(meta.duration_seconds) : undefined,
      callStart: meta.call_start || undefined,
      callEnd: meta.call_end || undefined,
      coachingDate: toDate(meta.coaching_date),
      flaggedReasonIds: [...new Set(reasonIds)],
    },
  };
}

/**
 * Group rows by eval_id, mark already-imported ids as duplicates, and resolve
 * the rest — a plan with no writes, shared by the dry-run and the real import.
 */
async function planGroups(
  config: LoadedConfig,
  rows: Record<string, string>[],
  resolver: AgentResolver,
): Promise<GroupPlan[]> {
  const reasonIndex = buildReasonIndex(config);
  const groups = new Map<string, Record<string, string>[]>();
  const plans: GroupPlan[] = [];

  for (const row of rows) {
    const evalId = row.eval_id;
    if (!evalId) {
      plans.push({ evalId: "(blank)", kind: "error", message: "row is missing eval_id" });
      continue;
    }
    const list = groups.get(evalId);
    if (list) list.push(row);
    else groups.set(evalId, [row]);
  }

  const existing = new Set(
    (
      await prisma.evaluation.findMany({
        where: { evalId: { in: [...groups.keys()] } },
        select: { evalId: true },
      })
    ).map((e) => e.evalId),
  );

  for (const [evalId, groupRows] of groups) {
    if (existing.has(evalId)) {
      plans.push({ evalId, kind: "duplicate" });
      continue;
    }
    const resolved = resolveGroup(reasonIndex, resolver, evalId, groupRows);
    plans.push(
      resolved.ok
        ? { evalId, kind: "ready", input: resolved.input }
        : { evalId, kind: "error", message: resolved.message },
    );
  }
  return plans;
}

export interface ImportValidation {
  ready: number;
  duplicate: number;
  errors: ImportError[];
}

/**
 * Dry-run validation (FR-18): report every orphan error reason, unresolvable
 * agent, and duplicate WITHOUT writing anything — so a user sees all problems
 * before committing the import.
 */
export async function validateImport(
  config: LoadedConfig,
  rows: Record<string, string>[],
  resolver: AgentResolver,
): Promise<ImportValidation> {
  const plans = await planGroups(config, rows, resolver);
  return {
    ready: plans.filter((p) => p.kind === "ready").length,
    duplicate: plans.filter((p) => p.kind === "duplicate").length,
    errors: plans.flatMap((p) =>
      p.kind === "error" ? [{ evalId: p.evalId, message: p.message }] : [],
    ),
  };
}

export async function importEvaluations(
  config: LoadedConfig,
  rows: Record<string, string>[],
  resolver: AgentResolver,
): Promise<ImportResult> {
  const plans = await planGroups(config, rows, resolver);
  let imported = 0;
  let skipped = 0;
  const errors: ImportError[] = [];

  for (const plan of plans) {
    if (plan.kind === "duplicate") {
      skipped += 1;
    } else if (plan.kind === "error") {
      errors.push({ evalId: plan.evalId, message: plan.message });
    } else {
      const outcome = await createEvaluation(config, plan.input);
      if (outcome.ok) imported += 1;
      else errors.push({ evalId: plan.evalId, message: outcome.error });
    }
  }

  return { imported, skipped, errors };
}
