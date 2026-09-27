"use server";

import { authorize } from "@/lib/auth";
import { AuthError } from "@/lib/auth/errors";
import { loadActiveConfig } from "@/lib/config/loader";
import { prisma } from "@/lib/db/client";
import { sendCoachingEmail } from "@/lib/coaching/coaching";
import { createEvaluation } from "@/lib/evaluations/create";
import { emailScorePosted } from "@/lib/notifications/service";
import type { EvaluationDraft } from "./types";

export type CreateEvaluationResult =
  | { ok: true; evalId: string; coaching?: "sent" | "passed" | "error" }
  | { ok: false; message: string };

/**
 * Persist a score sheet (FR-16). The engine derives all figures. Optionally, a
 * scorer with `coaching.send` can pass `coachingText` to fire a coaching email
 * on save — only if the resulting call FAILED (coaching is failed-only).
 */
export async function createEvaluationAction(
  draft: EvaluationDraft,
  coachingText?: string,
): Promise<CreateEvaluationResult> {
  let ctx;
  try {
    ctx = await authorize("evaluations.create");
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
    comment: draft.comment,
    flaggedReasonIds: draft.flaggedReasonIds,
  });

  if (!result.ok) return { ok: false, message: result.error };

  // Email the agent that a call was scored (best-effort; import never emails).
  await emailScorePosted(draft.agentLoginId, new Date(draft.callDate));

  // Optional coaching email — only for failed calls, only with the permission.
  let coaching: "sent" | "passed" | "error" | undefined;
  if (coachingText && coachingText.trim() && ctx.permissions.has("coaching.send")) {
    const created = await prisma.evaluation.findUnique({
      where: { evalId: result.evalId },
      select: { failedScorecard: true },
    });
    if (created?.failedScorecard) {
      const sent = await sendCoachingEmail(result.evalId, ctx.user.id, coachingText);
      coaching = sent.ok ? "sent" : "error";
    } else {
      coaching = "passed"; // call passed → coaching not applicable
    }
  }

  return { ok: true, evalId: result.evalId, coaching };
}
