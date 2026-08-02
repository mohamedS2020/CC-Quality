import { Prisma, type Period, type PeriodStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";

/**
 * Period lifecycle (FR-44). Evaluations belong to the operational MONTH period,
 * which is opened on demand. A period moves open → scoring → review → locked,
 * and can be reopened; once LOCKED, its evaluations are immutable (enforced in
 * `createEvaluation`), and corrections become new versioned rows (task 6.8).
 */

export function monthPeriodBounds(date: Date): { label: string; start: Date; end: Date } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-11
  return {
    label: `${year}-${String(month + 1).padStart(2, "0")}`,
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 0)),
  };
}

/** Find-or-open the MONTH period for a call date. */
export async function resolveMonthlyPeriod(date: Date): Promise<Period> {
  const { label, start, end } = monthPeriodBounds(date);
  return prisma.period.upsert({
    where: { type_label: { type: "MONTH", label } },
    update: {},
    create: { type: "MONTH", label, startDate: start, endDate: end, status: "OPEN" },
  });
}

export function isPeriodEditable(period: Pick<Period, "status">): boolean {
  return period.status !== "LOCKED";
}

// Allowed transitions: open/scoring/review flow freely and can lock; a locked
// period can only be reopened (→ open).
const ALLOWED: Record<PeriodStatus, PeriodStatus[]> = {
  OPEN: ["SCORING", "REVIEW", "LOCKED"],
  SCORING: ["OPEN", "REVIEW", "LOCKED"],
  REVIEW: ["OPEN", "SCORING", "LOCKED"],
  LOCKED: ["OPEN"],
};

export function canTransition(from: PeriodStatus, to: PeriodStatus): boolean {
  return from === to || ALLOWED[from].includes(to);
}

export type TransitionOutcome = { ok: true; period: Period } | { ok: false; error: string };

/** Move a period to a new status, stamping lock/reopen audit (FR-45). */
export async function transitionPeriod(
  periodId: number,
  to: PeriodStatus,
  userId: number,
): Promise<TransitionOutcome> {
  const period = await prisma.period.findUnique({ where: { id: periodId } });
  if (!period) return { ok: false, error: "Period not found." };
  if (period.status === to) return { ok: true, period };
  if (!canTransition(period.status, to)) {
    return { ok: false, error: `Cannot move a ${period.status} period to ${to}.` };
  }

  const now = new Date();
  const data: Prisma.PeriodUncheckedUpdateInput = { status: to };
  if (to === "LOCKED") {
    data.lockedAt = now;
    data.lockedById = userId;
  }
  if (period.status === "LOCKED" && to === "OPEN") {
    data.reopenedAt = now;
    data.reopenedById = userId;
  }

  return { ok: true, period: await prisma.period.update({ where: { id: periodId }, data }) };
}

export function listPeriods() {
  return prisma.period.findMany({
    orderBy: [{ type: "asc" }, { label: "desc" }],
    include: { _count: { select: { evaluations: true } } },
  });
}
