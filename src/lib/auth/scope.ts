import type { AuthContext } from "./context";

/**
 * Agent self-scoping (FR-9). This is a data filter applied *on top of* the
 * permission check: `authorize` decides whether a caller may run a query; the
 * scope decides whose rows come back. Agents are hard-limited to their own
 * login_id; Admins and Moderators see every agent.
 *
 * Every agent-data query (evaluations, reports, agent lists) must derive its
 * `where` from `agentScopeFor(ctx)` so self-scoping can never be forgotten at a
 * call site.
 */
export type AgentScope = { kind: "all" } | { kind: "self"; loginId: number };

/** Impossible login_id used to fail an unlinked Agent closed (matches no rows). */
const NO_MATCH_LOGIN_ID = -1;

export function agentScopeFor(ctx: AuthContext): AgentScope {
  if (ctx.user.role !== "AGENT") return { kind: "all" };
  // An AGENT user must be linked to an Agent record (FR-3). If somehow unlinked,
  // fail closed: scope to an impossible id so queries return nothing.
  return { kind: "self", loginId: ctx.user.agentLoginId ?? NO_MATCH_LOGIN_ID };
}

/** Prisma `where` fragment restricting Evaluation queries to `scope`. */
export function evaluationScopeWhere(scope: AgentScope): { agentLoginId?: number } {
  return scope.kind === "all" ? {} : { agentLoginId: scope.loginId };
}

/** Prisma `where` fragment restricting Agent queries to `scope`
 *  (an Agent listing agents sees only their own record). */
export function agentScopeWhere(scope: AgentScope): { loginId?: number } {
  return scope.kind === "all" ? {} : { loginId: scope.loginId };
}
