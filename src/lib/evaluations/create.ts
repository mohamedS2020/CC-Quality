import type { Prisma } from "@prisma/client";
import type { LoadedConfig } from "@/lib/config/loader";
import { prisma } from "@/lib/db/client";
import { scoreCall } from "@/lib/engine/score";
import { isPeriodEditable, resolveMonthlyPeriod } from "@/lib/periods/period";
import { maskMobile } from "@/lib/pii";

/**
 * A score sheet's ENTER-ONLY fields (Appendix E.2) plus the flagged reasons.
 * There is deliberately no place for a count, accuracy, status, or rank — those
 * are derived below, so a typed figure can never enter the system (FR-16).
 */
export interface CreateEvaluationInput {
  /** Source id (imports preserve it for dedupe); omitted for form entry → generated. */
  evalId?: string;
  agentLoginId: number;
  qaOwner: string;
  callDate: Date;
  callStart?: string; // "HH:MM"
  callEnd?: string;
  durationSeconds?: number;
  mobile?: string;
  callId?: string;
  queue?: string;
  transactionType?: string;
  monitoringType?: string;
  callType?: string;
  coachingDate?: Date;
  flaggedReasonIds: number[];
}

export type CreateEvaluationOutcome = { ok: true; evalId: string } | { ok: false; error: string };

/** The version-chain fields set when writing a row (task 6.8). */
export interface EvaluationVersionFields {
  periodId: number;
  version: number;
  correctionOfId?: string;
  correctedById?: number;
  correctionReason?: string;
}

function timeToDate(time: string | undefined): Date | null {
  if (!time) return null;
  const date = new Date(`1970-01-01T${time}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Assemble the row to persist from the enter-only input, the config version it
 * was scored under, and the engine's derived figures. This is the SINGLE place
 * a stored evaluation is shaped — both first-scoring and corrections (task 6.8)
 * go through it, so a correction is byte-for-byte a re-derivation, never a mutation.
 */
export function buildEvaluationData(
  input: CreateEvaluationInput,
  configId: number,
  reasonIds: number[],
  scored: ReturnType<typeof scoreCall>,
  version: EvaluationVersionFields,
): Prisma.EvaluationUncheckedCreateInput {
  return {
    evalId: input.evalId, // undefined → Prisma generates a cuid
    agentLoginId: input.agentLoginId,
    configId,
    periodId: version.periodId,
    qaOwner: input.qaOwner,
    callDate: input.callDate,
    callStart: timeToDate(input.callStart),
    callEnd: timeToDate(input.callEnd),
    durationSeconds: input.durationSeconds ?? null,
    mobileMasked: input.mobile ? maskMobile(input.mobile) : null,
    callId: input.callId ?? null,
    queue: input.queue ?? null,
    transactionType: input.transactionType ?? null,
    monitoringType: input.monitoringType ?? null,
    callType: input.callType ?? null,
    coachingDate: input.coachingDate ?? null,
    version: version.version,
    correctionOfId: version.correctionOfId ?? null,
    correctedById: version.correctedById ?? null,
    correctionReason: version.correctionReason ?? null,
    sumOfCriticals: scored.sumOfCriticals,
    failedScorecard: scored.failedScorecard,
    overallStatus: scored.failedScorecard ? "Fail" : "Pass",
    lines: { create: reasonIds.map((errorReasonId) => ({ errorReasonId })) },
  };
}

/**
 * Derive every figure from the flagged reasons via the engine and persist
 * EVALUATION + LINES, stamped with the config version (FR-31). `config` is the
 * already-resolved config to score against (the caller passes the active one),
 * which keeps this service decoupled from the active-version pointer.
 */
export async function createEvaluation(
  config: LoadedConfig,
  input: CreateEvaluationInput,
): Promise<CreateEvaluationOutcome> {
  const agent = await prisma.agent.findUnique({ where: { loginId: input.agentLoginId } });
  if (!agent) return { ok: false, error: `Unknown agent ${input.agentLoginId}.` };
  if (!agent.active) return { ok: false, error: `Agent ${input.agentLoginId} is inactive.` };

  const reasonIds = [...new Set(input.flaggedReasonIds)];
  const unknown = reasonIds.find((id) => !config.errorReasonById.has(id));
  if (unknown !== undefined) {
    return { ok: false, error: `Error reason ${unknown} is not in the active configuration.` };
  }

  // A locked period is immutable — no new calls may land in it (FR-44);
  // corrections there must go through versioning (task 6.8).
  const period = await resolveMonthlyPeriod(input.callDate);
  if (!isPeriodEditable(period)) {
    return { ok: false, error: `The ${period.label} period is locked.` };
  }

  // Every stored figure is derived here — never accepted from the caller.
  const scored = scoreCall(config, reasonIds);

  const evaluation = await prisma.evaluation.create({
    data: buildEvaluationData(input, config.id, reasonIds, scored, {
      periodId: period.id,
      version: 1,
    }),
  });

  return { ok: true, evalId: evaluation.evalId };
}
