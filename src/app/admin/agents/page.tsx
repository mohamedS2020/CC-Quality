import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { deriveAgentStanding } from "@/lib/agents/status";
import { loadActiveConfig } from "@/lib/config/loader";
import { agentRepository } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AgentsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("agents.manage")) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">403 — Forbidden</h1>
        <p className="page-sub">You need the “Manage agents” permission.</p>
      </main>
    );
  }

  const [agents, config] = await Promise.all([agentRepository.list(), loadActiveConfig()]);

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
          <h1 className="page-title">Agents</h1>
          <p className="page-sub">
            Tenure and trial are derived from join date
            {config
              ? ` (new < ${config.newAgentTenureDays}d, trial < ${config.trialWindowDays}d).`
              : "."}
          </p>
        </div>
        <Link href="/admin/agents/new" className="btn btn-primary">
          + New agent
        </Link>
      </div>

      <div className="card" style={{ marginTop: "1.5rem", padding: "0.5rem 0.75rem" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Login ID</th>
              <th>Agent</th>
              <th>Team leader</th>
              <th>Join date</th>
              <th>Tenure</th>
              <th>Trial</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => {
              const standing = config ? deriveAgentStanding(a.joinDate, config) : null;
              return (
                <tr key={a.loginId}>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{a.loginId}</td>
                  <td>{a.agentName}</td>
                  <td className="muted">{a.tlName}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{ymd(a.joinDate)}</td>
                  <td>
                    {standing ? (
                      <>
                        {standing.status} <span className="muted">({standing.tenureDays}d)</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {standing?.inTrial ? (
                      <span className="badge badge-warning">In trial</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {a.active ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge">Inactive</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link href={`/admin/agents/${a.loginId}`}>Edit →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
