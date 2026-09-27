import type { ReportScope, TimeSlice } from "./metrics";

/**
 * Shared scope + time-window resolution for the reports page, the drill-down and
 * the export route, so a URL always means the same report in all three. Agents
 * are hard-scoped to their own login_id (FR-38); everyone else chooses
 * account / TL / agent.
 */

export type ScopeResult =
  | {
      ok: true;
      scope: ReportScope;
      kind: "account" | "tl" | "agent";
      tl: string | null;
      agentLoginId: number | null;
    }
  | {
      ok: false;
      reason: "no-agent-link" | "pick";
      kind: "account" | "tl" | "agent";
      tl: string | null;
      agentLoginId: number | null;
      message: string;
    };

export function resolveScope(
  params: { scope?: string; tl?: string; agent?: string },
  user: { role: string; agentLoginId: number | null },
): ScopeResult {
  if (user.role === "AGENT") {
    if (user.agentLoginId == null) {
      return {
        ok: false,
        reason: "no-agent-link",
        kind: "agent",
        tl: null,
        agentLoginId: null,
        message: "Your account isn’t linked to an agent record.",
      };
    }
    return {
      ok: true,
      scope: { kind: "agent", loginId: user.agentLoginId },
      kind: "agent",
      tl: null,
      agentLoginId: user.agentLoginId,
    };
  }

  const kind = params.scope === "tl" || params.scope === "agent" ? params.scope : "account";
  const tl = params.tl || null;
  const agentLoginId = params.agent ? Number(params.agent) : null;

  if (kind === "tl") {
    if (!tl)
      return {
        ok: false,
        reason: "pick",
        kind,
        tl,
        agentLoginId,
        message: "Choose a team leader to see their agents.",
      };
    return { ok: true, scope: { kind: "tl", tlName: tl }, kind, tl, agentLoginId };
  }
  if (kind === "agent") {
    if (agentLoginId == null)
      return {
        ok: false,
        reason: "pick",
        kind,
        tl,
        agentLoginId,
        message: "Choose an agent to see their scorecard.",
      };
    return { ok: true, scope: { kind: "agent", loginId: agentLoginId }, kind, tl, agentLoginId };
  }
  return { ok: true, scope: { kind: "account" }, kind, tl: null, agentLoginId: null };
}

/** The period immediately before `selectedId` in a newest-first list (for deltas). */
export function previousPeriodId(periods: { id: number }[], selectedId: number): number | null {
  const idx = periods.findIndex((p) => p.id === selectedId);
  return idx >= 0 && idx + 1 < periods.length ? periods[idx + 1].id : null;
}

// --- Time window ------------------------------------------------------------

/**
 * The stretch of time a report covers: either a preset month or the free
 * From/To range the user picked. Exactly one of `period` / (`from`,`to`) is set,
 * so the window round-trips through the URL unambiguously.
 */
export interface ReportWindow {
  current: TimeSlice;
  /** What the deltas are measured against, or null when there's nothing prior. */
  previous: TimeSlice | null;
  /** Human label for the subtitle, export metadata and empty states. */
  label: string;
  period: string | null;
  from: string | null;
  to: string | null;
}

export interface ResolvedWindow {
  window: ReportWindow;
  /** Why a requested range was rejected; the window falls back to the period. */
  invalid: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/**
 * Parse a `YYYY-MM-DD` filter value as UTC midnight, or null if it isn't a real
 * date. UTC (never local) so a range lines up exactly with the month periods,
 * which `monthPeriodBounds` also buckets in UTC.
 */
export function parseFilterDate(value: string | undefined | null): Date | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Reject rollovers like 2026-02-31, which Date.UTC would silently accept.
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? dt
    : null;
}

/**
 * Resolve the report's time window. A valid `from`+`to` pair wins over the
 * period; anything unusable (missing half, malformed, reversed) falls back to
 * the period and reports why — never a 500, and never a silently wider query.
 */
export function resolveWindow(
  params: { from?: string; to?: string },
  period: { periodId: number; previousPeriodId: number | null; label: string },
): ResolvedWindow {
  const fallback: ReportWindow = {
    current: { kind: "period", periodId: period.periodId },
    previous:
      period.previousPeriodId != null
        ? { kind: "period", periodId: period.previousPeriodId }
        : null,
    label: period.label,
    period: period.label,
    from: null,
    to: null,
  };

  const fromISO = params.from ?? "";
  const toISO = params.to ?? "";
  if (!fromISO && !toISO) return { window: fallback, invalid: null };

  const from = parseFilterDate(fromISO);
  const to = parseFilterDate(toISO);
  if (!from || !to) {
    return { window: fallback, invalid: "Pick both a From and a To date to use a custom range." };
  }
  if (from.getTime() > to.getTime()) {
    return { window: fallback, invalid: "“From” must be on or before “To”." };
  }

  // Half-open upper bound: the day AFTER `to`, so the whole final day counts.
  const toExclusive = new Date(to.getTime() + DAY_MS);
  const span = toExclusive.getTime() - from.getTime();

  return {
    window: {
      current: { kind: "range", from, toExclusive },
      // Deltas compare against the equally-long stretch ending the day before `from`.
      previous: { kind: "range", from: new Date(from.getTime() - span), toExclusive: from },
      label: fromISO === toISO ? fromISO : `${fromISO} → ${toISO}`,
      period: null,
      from: fromISO,
      to: toISO,
    },
    invalid: null,
  };
}
