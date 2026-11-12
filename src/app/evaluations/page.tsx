import Link from "next/link";
import { getAuthContext, redirectToLogin } from "@/lib/auth";
import { agentScopeFor } from "@/lib/auth/scope";
import { listCurrentEvaluations } from "@/lib/evaluations/query";
import { EvaluationsList, type EvalRow } from "./evaluations-list";

export const dynamic = "force-dynamic";

export default async function EvaluationsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return redirectToLogin();

  if (!ctx.permissions.has("evaluations.view")) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">403 — Forbidden</h1>
        <p className="page-sub">You need the “View evaluations” permission.</p>
      </main>
    );
  }

  // Agents see only their own calls (FR-9); Admins/Moderators see all.
  const evaluations = await listCurrentEvaluations(agentScopeFor(ctx));

  // Phone search and the agent / team-leader filters are for Admins/Moderators;
  // agents are self-scoped, so they only get the Pass/Fail filter.
  const canSearch = ctx.user.role !== "AGENT";

  const rows: EvalRow[] = evaluations.map((e) => ({
    evalId: e.evalId,
    callDate: e.callDate.toISOString().slice(0, 10),
    agentLoginId: e.agentLoginId,
    agentName: e.agent.agentName,
    tlName: e.agent.tlName,
    qaOwner: e.qaOwner,
    status: e.overallStatus ?? (e.failedScorecard ? "Fail" : "Pass"),
    failed: e.failedScorecard,
    configVersion: e.config.version,
    corrected: e.version > 1,
    phoneMasked: e.mobileMasked,
  }));

  return (
    <main className="page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "1rem",
        }}
      >
        <div>
          <h1 className="page-title">Evaluations</h1>
          <p className="page-sub">The current version of every scored call.</p>
        </div>
        {ctx.permissions.has("evaluations.create") && (
          <Link prefetch={false} href="/evaluations/new" className="btn btn-primary">
            + New score sheet
          </Link>
        )}
      </div>

      <EvaluationsList rows={rows} canSearch={canSearch} />
    </main>
  );
}
