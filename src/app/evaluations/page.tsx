import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { agentScopeFor } from "@/lib/auth/scope";
import { listCurrentEvaluations } from "@/lib/evaluations/query";

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function EvaluationsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

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
          <Link href="/evaluations/new" className="btn btn-primary">
            + New score sheet
          </Link>
        )}
      </div>

      <div className="card" style={{ marginTop: "1.5rem", padding: "0.5rem 0.75rem" }}>
        {evaluations.length === 0 ? (
          <p className="empty" style={{ border: "none" }}>
            No evaluations yet.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Call date</th>
                <th>Agent</th>
                <th>QA owner</th>
                <th>Result</th>
                <th>Config</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((e) => (
                <tr key={e.evalId}>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmtDate(e.callDate)}</td>
                  <td>{e.agent.agentName}</td>
                  <td className="muted">{e.qaOwner}</td>
                  <td>
                    <span
                      className={e.failedScorecard ? "badge badge-danger" : "badge badge-success"}
                    >
                      {e.overallStatus ?? (e.failedScorecard ? "Fail" : "Pass")}
                    </span>
                  </td>
                  <td>
                    <span title="Scorecard configuration version">v{e.config.version}</span>
                    {e.version > 1 && (
                      <span className="badge badge-accent" style={{ marginLeft: "0.4rem" }}>
                        corrected
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link href={`/evaluations/${e.evalId}`}>View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
