"use server";

import { authorize } from "@/lib/auth";
import { AuthError } from "@/lib/auth/errors";
import { loadActiveConfig } from "@/lib/config/loader";
import { buildAgentResolver } from "@/lib/agents/normalize";
import {
  importEvaluations,
  parseCsv,
  parseXlsx,
  validateImport,
  type ImportResult,
  type ImportValidation,
} from "@/lib/evaluations/import";

export type ValidateResult =
  { ok: true; validation: ImportValidation } | { ok: false; message: string };
export type ImportRunResult = { ok: true; result: ImportResult } | { ok: false; message: string };

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

async function parseUpload(file: File): Promise<Record<string, string>[]> {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    return parseXlsx(Buffer.from(await file.arrayBuffer()));
  }
  return parseCsv(await file.text());
}

function readFile(formData: FormData): File | null {
  const file = formData.get("file");
  return file instanceof File && file.size > 0 ? file : null;
}

/** Dry-run: preview every problem before committing (FR-18). */
export async function validateImportAction(formData: FormData): Promise<ValidateResult> {
  const denied = await guard();
  if (denied) return { ok: false, message: denied };

  const file = readFile(formData);
  if (!file) return { ok: false, message: "Please choose a CSV or .xlsx file." };

  const config = await loadActiveConfig();
  if (!config) return { ok: false, message: "No active configuration to import against." };

  const resolver = await buildAgentResolver();
  return { ok: true, validation: await validateImport(config, await parseUpload(file), resolver) };
}

/** Commit the import (FR-17). */
export async function runImportAction(formData: FormData): Promise<ImportRunResult> {
  const denied = await guard();
  if (denied) return { ok: false, message: denied };

  const file = readFile(formData);
  if (!file) return { ok: false, message: "Please choose a CSV or .xlsx file." };

  const config = await loadActiveConfig();
  if (!config) return { ok: false, message: "No active configuration to import against." };

  const resolver = await buildAgentResolver();
  return { ok: true, result: await importEvaluations(config, await parseUpload(file), resolver) };
}
