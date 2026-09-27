import "server-only";
import { prisma } from "@/lib/db/client";

/**
 * Non-versioned operational settings (a JSON key/value store). These are lists
 * that must be editable anytime WITHOUT minting a new config version, because
 * they don't affect scoring reproducibility:
 *  - `call_types`   — the evaluation form's Call type dropdown options.
 *  - `coaching_cc`  — CC recipients added to every coaching email.
 */

const CALL_TYPES = "call_types";
const COACHING_CC = "coaching_cc";

async function getList(key: string): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key } });
  const value = row?.value;
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

/** Trim, drop blanks, de-duplicate (order preserved) before persisting. */
async function setList(key: string, values: string[]): Promise<void> {
  const clean = [...new Set(values.map((s) => s.trim()).filter((s) => s !== ""))];
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: clean },
    update: { value: clean },
  });
}

/**
 * Call type options, always alphabetical.
 *
 * Stored order carries no meaning for a dropdown, and the editor appends new
 * options to the end, so the list is sorted on READ rather than trusting how it
 * happens to be stored: an option added later slots into place instead of
 * landing at the bottom, whoever wrote it (editor, seed, or a direct write).
 * Locale-aware, so "Not related" precedes "NPS" the way a person reads it —
 * a code-unit sort puts them the other way round.
 */
export const getCallTypes = async (): Promise<string[]> =>
  (await getList(CALL_TYPES)).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

export const setCallTypes = (values: string[]): Promise<void> => setList(CALL_TYPES, values);

export const getCoachingCc = (): Promise<string[]> => getList(COACHING_CC);
export const setCoachingCc = (values: string[]): Promise<void> => setList(COACHING_CC, values);
