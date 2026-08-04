import type { ReportScope } from "./metrics";

/**
 * Shared scope + period resolution for the reports page and the export route, so
 * a URL always means the same report in both. Agents are hard-scoped to their
 * own login_id (FR-38); everyone else chooses account / TL / agent.
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
