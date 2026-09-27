import "server-only";
import { prisma } from "@/lib/db/client";
import { normalizeReason } from "./normalize";
import { aliasKey, type AliasIndex, type ReasonRef } from "./reason-match";

/** The persisted reason "Data Standard" — source wording → canonical config reason. */

export async function loadAliasIndex(): Promise<AliasIndex> {
  const rows = await prisma.reasonAlias.findMany();
  const index: AliasIndex = new Map();
  for (const r of rows) {
    index.set(`${r.sectionCode}|${r.sourceNormalized}`, {
      attribute: r.attribute,
      reason: r.reason,
    });
  }
  return index;
}

export interface AliasInput extends ReasonRef {
  sectionCode: string;
  source: string;
}

/** Upsert a batch of aliases (idempotent on `(sectionCode, normalisedSource)`). */
export async function saveAliases(entries: AliasInput[]): Promise<void> {
  for (const e of entries) {
    const sourceNormalized = normalizeReason(e.source);
    if (!sourceNormalized || !e.attribute.trim() || !e.reason.trim()) continue;
    await prisma.reasonAlias.upsert({
      where: { sectionCode_sourceNormalized: { sectionCode: e.sectionCode, sourceNormalized } },
      create: {
        sectionCode: e.sectionCode,
        sourceNormalized,
        sourceSample: e.source.trim(),
        attribute: e.attribute,
        reason: e.reason,
      },
      update: { attribute: e.attribute, reason: e.reason, sourceSample: e.source.trim() },
    });
  }
}

export { aliasKey };
