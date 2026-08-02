import { loadConfigById } from "@/lib/config/loader";
import { prisma } from "@/lib/db/client";
import { notifyCorrectionPosted } from "@/lib/notifications/service";
import { scoreCall } from "@/lib/engine/score";
import { isPeriodEditable, resolveMonthlyPeriod } from "@/lib/periods/period";
import { buildEvaluationData, type CreateEvaluationInput } from "./create";

/**
 * A correction re-submits the whole corrected score sheet plus a mandatory
 * reason. It never carries figures (same FR-16 guarantee as first-scoring).
 */
export interface CorrectionInput extends Omit<CreateEvaluationInput, "evalId"> {
  reason: string;
}

export type CorrectEvaluationOutcome = { ok: true; evalId: string } | { ok: false; error: string };

/**
 * Post a versioned correction (FR-14/15). The scored row is NEVER mutated: the
 * old version is stamped `supersededAt`, and a NEW version is written, linked
 * back to it, carrying who/when/why. Re-scoring uses the SAME config version the
 * original was scored under, so only the changed inputs move the numbers — not a
 * silent methodology change. A locked period blocks the correction (FR-44).
 */
export async function correctEvaluation(
  originalEvalId: string,
  input: CorrectionInput,
  userId: number,
): Promise<CorrectEvaluationOutcome> {
  const reason = input.reason.trim();
  if (reason === "") return { ok: false, error: "A correction reason is required." };

  const original = await prisma.evaluation.findUnique({ where: { evalId: originalEvalId } });
  if (!original) return { ok: false, error: "Evaluation not found." };
  if (original.supersededAt) {
    return { ok: false, error: "Only the current version of a call can be corrected." };
  }

  // The row being corrected must live in an editable period.
  if (original.periodId) {
    const originalPeriod = await prisma.period.findUnique({ where: { id: original.periodId } });
    if (originalPeriod && !isPeriodEditable(originalPeriod)) {
      return { ok: false, error: `The ${originalPeriod.label} period is locked.` };
    }
  }

  const agent = await prisma.agent.findUnique({ where: { loginId: input.agentLoginId } });
  if (!agent) return { ok: false, error: `Unknown agent ${input.agentLoginId}.` };
  if (!agent.active) return { ok: false, error: `Agent ${input.agentLoginId} is inactive.` };

  // Re-derive under the version the original was scored with (FR-31).
  const config = await loadConfigById(original.configId);
  if (!config) return { ok: false, error: "The original configuration version is unavailable." };

  const reasonIds = [...new Set(input.flaggedReasonIds)];
  const unknown = reasonIds.find((id) => !config.errorReasonById.has(id));
  if (unknown !== undefined) {
    return { ok: false, error: `Error reason ${unknown} is not in the scored configuration.` };
  }

  // The corrected call must also land in an editable period.
  const targetPeriod = await resolveMonthlyPeriod(input.callDate);
  if (!isPeriodEditable(targetPeriod)) {
    return { ok: false, error: `The ${targetPeriod.label} period is locked.` };
  }

  const scored = scoreCall(config, reasonIds);
  const now = new Date();

  const created = await prisma.$transaction(async (tx) => {
    // Stamp the old row superseded (audit: when it was replaced).
    await tx.evaluation.update({ where: { evalId: originalEvalId }, data: { supersededAt: now } });
    // Write the new version, linked back to the one it replaces (who/why).
    return tx.evaluation.create({
      data: buildEvaluationData({ ...input, evalId: undefined }, config.id, reasonIds, scored, {
        periodId: targetPeriod.id,
        version: original.version + 1,
        correctionOfId: originalEvalId,
        correctedById: userId,
        correctionReason: reason,
      }),
    });
  });

  // Notify the agent's linked user of the correction (best-effort, FR-45).
  await notifyCorrectionPosted(
    input.agentLoginId,
    created.evalId,
    created.overallStatus,
    input.callDate,
  );

  return { ok: true, evalId: created.evalId };
}
