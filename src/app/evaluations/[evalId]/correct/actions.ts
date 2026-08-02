"use server";

import { authorize } from "@/lib/auth";
import { AuthError } from "@/lib/auth/errors";
import { correctEvaluation } from "@/lib/evaluations/correct";
import type { EvaluationDraft } from "../../new/types";

export type CorrectionResult = { ok: true; evalId: string } | { ok: false; message: string };

/**
 * Post a versioned correction (FR-14/15), guarded by `evaluations.edit`. The
 * service supersedes the current version and writes a re-derived new one — the
 * draft still carries no figures, only enter-only fields + a mandatory reason.
 */
export async function correctEvaluationAction(
  originalEvalId: string,
  draft: EvaluationDraft,
  reason: string,
): Promise<CorrectionResult> {
  let userId: number;
  try {
    const ctx = await authorize("evaluations.edit");
    userId = ctx.user.id;
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        message:
          error.status === 401
            ? "You are not signed in."
            : "You do not have permission to edit evaluations.",
      };
    }
    throw error;
  }

  if (!draft.agentLoginId || !draft.callDate || !draft.qaOwner.trim()) {
    return { ok: false, message: "Agent, call date, and QA owner are required." };
  }
  if (!reason.trim()) {
    return { ok: false, message: "A correction reason is required." };
  }

  const result = await correctEvaluation(
    originalEvalId,
    {
      agentLoginId: draft.agentLoginId,
      qaOwner: draft.qaOwner.trim(),
      callDate: new Date(draft.callDate),
      callStart: draft.callStart,
      callEnd: draft.callEnd,
      durationSeconds: draft.durationSeconds,
      mobile: draft.mobile,
      callId: draft.callId,
      queue: draft.queue,
      transactionType: draft.transactionType,
      monitoringType: draft.monitoringType,
      callType: draft.callType,
      coachingDate: draft.coachingDate ? new Date(draft.coachingDate) : undefined,
      flaggedReasonIds: draft.flaggedReasonIds,
      reason: reason.trim(),
    },
    userId,
  );

  return result.ok ? { ok: true, evalId: result.evalId } : { ok: false, message: result.error };
}
