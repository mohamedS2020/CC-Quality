"use server";

import { authorize } from "@/lib/auth";
import { AuthError } from "@/lib/auth/errors";
import { loadActiveConfig } from "@/lib/config/loader";
import { createEvaluation } from "@/lib/evaluations/create";
import type { EvaluationDraft } from "./types";

export type CreateEvaluationResult = { ok: true; evalId: string } | { ok: false; message: string };

/**
 * Persist a score sheet (FR-16). Guarded by `evaluations.create`; the engine
 * derives all counts/accuracies/status from the flagged reasons — the draft
 * carries no figures to type in.
 */
export async function createEvaluationAction(
  draft: EvaluationDraft,
): Promise<CreateEvaluationResult> {
  try {
    await authorize("evaluations.create");
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        message:
          error.status === 401
            ? "You are not signed in."
            : "You do not have permission to create evaluations.",
      };
    }
    throw error;
  }

  if (!draft.agentLoginId || !draft.callDate || !draft.qaOwner.trim()) {
    return { ok: false, message: "Agent, call date, and QA owner are required." };
  }

  const config = await loadActiveConfig();
  if (!config) {
    return { ok: false, message: "No active configuration to score against." };
  }

  const result = await createEvaluation(config, {
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
  });

  return result.ok ? { ok: true, evalId: result.evalId } : { ok: false, message: result.error };
}
