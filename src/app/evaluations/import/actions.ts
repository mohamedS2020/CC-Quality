"use server";

import { authorize } from "@/lib/auth";
import { AuthError } from "@/lib/auth/errors";
import { loadActiveConfig, type LoadedConfig } from "@/lib/config/loader";
import { buildAgentResolver } from "@/lib/agents/normalize";
import {
  importEvaluations,
  validateImport,
  type ImportResult,
  type ImportValidation,
} from "@/lib/evaluations/import";
import { isWideFormat, readSheetCsv, readSheetXlsx, type RawSheet } from "@/lib/import/sheet";
import { parseWide } from "@/lib/import/wide";
import { transformWide, type UnmappedReason } from "@/lib/import/wide-transform";
import { loadAliasIndex, saveAliases, type AliasInput } from "@/lib/import/reason-aliases";

export interface ReasonOption {
  attribute: string;
  reason: string;
}
export interface WideExtras {
  wide: true;
  unmapped: UnmappedReason[];
  reasonOptions: { sectionCode: string; options: ReasonOption[] }[];
  callCount: number;
}

export type ValidateResult =
  { ok: true; validation: ImportValidation; wide?: WideExtras } | { ok: false; message: string };
export type ImportRunResult = { ok: true; result: ImportResult } | { ok: false; message: string };
export type SaveAliasesResult = { ok: true } | { ok: false; message: string };

async function guard(): Promise<string | null> {
  try {
    await authorize("imports.run");
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401 ? "You are not signed in." : "You cannot run imports.";
    }
    throw error;
  }
}

function readFile(formData: FormData): File | null {
  const file = formData.get("file");
  return file instanceof File && file.size > 0 ? file : null;
}

async function loadSheet(file: File): Promise<RawSheet> {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    return readSheetXlsx(Buffer.from(await file.arrayBuffer()));
  }
  return readSheetCsv(await file.text());
}

/** Long-format: key each row by header (matches the classic importer). */
function sheetToRecords(sheet: RawSheet): Record<string, string>[] {
  return sheet.rows.map((cells) => {
    const rec: Record<string, string> = {};
    sheet.header.forEach((h, i) => {
      if (h) rec[h] = (cells[i] ?? "").trim();
    });
    return rec;
  });
}

function reasonOptionsFor(config: LoadedConfig): WideExtras["reasonOptions"] {
  return config.sections.map((s) => ({
    sectionCode: s.code,
    options: s.categories.flatMap((c) =>
      c.attributes.flatMap((a) =>
        a.errorReasons.map((r) => ({ attribute: a.label, reason: r.label })),
      ),
    ),
  }));
}

/** Produce the long-format rows to import, auto-detecting wide vs long. */
async function buildRows(
  config: LoadedConfig,
  file: File,
): Promise<{ rows: Record<string, string>[]; wide?: WideExtras }> {
  const sheet = await loadSheet(file);
  const codes = config.sections.map((s) => s.code);
  if (!isWideFormat(sheet.header, codes)) return { rows: sheetToRecords(sheet) };

  const calls = parseWide(sheet, codes);
  const transformed = transformWide(config, calls, await loadAliasIndex());
  return {
    rows: transformed.rows,
    wide: {
      wide: true,
      unmapped: transformed.unmapped,
      reasonOptions: reasonOptionsFor(config),
      callCount: transformed.callCount,
    },
  };
}

/** Dry-run: preview every problem before committing (FR-18). */
export async function validateImportAction(formData: FormData): Promise<ValidateResult> {
  const denied = await guard();
  if (denied) return { ok: false, message: denied };

  const file = readFile(formData);
  if (!file) return { ok: false, message: "Please choose a CSV or .xlsx file." };

  const config = await loadActiveConfig();
  if (!config) return { ok: false, message: "No active configuration to import against." };

  const { rows, wide } = await buildRows(config, file);
  const validation = await validateImport(config, rows, await buildAgentResolver());
  return { ok: true, validation, wide };
}

/** Commit the import (FR-17). Blocked while any wide reason is unmapped. */
export async function runImportAction(formData: FormData): Promise<ImportRunResult> {
  const denied = await guard();
  if (denied) return { ok: false, message: denied };

  const file = readFile(formData);
  if (!file) return { ok: false, message: "Please choose a CSV or .xlsx file." };

  const config = await loadActiveConfig();
  if (!config) return { ok: false, message: "No active configuration to import against." };

  const { rows, wide } = await buildRows(config, file);
  if (wide && wide.unmapped.length > 0) {
    return {
      ok: false,
      message: `Map the ${wide.unmapped.length} unmapped reason(s) before importing.`,
    };
  }
  return { ok: true, result: await importEvaluations(config, rows, await buildAgentResolver()) };
}

/** Save reason aliases the admin picked for unmapped source reasons. */
export async function saveReasonAliasesAction(entries: AliasInput[]): Promise<SaveAliasesResult> {
  const denied = await guard();
  if (denied) return { ok: false, message: denied };
  await saveAliases(entries);
  return { ok: true };
}
