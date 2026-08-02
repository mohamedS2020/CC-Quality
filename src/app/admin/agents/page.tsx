import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { deriveAgentStanding } from "@/lib/agents/status";
import { loadActiveConfig } from "@/lib/config/loader";
import { agentRepository } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

const shell: React.CSSProperties = { maxWidth: 1050, margin: "0 auto", padding: "2.5rem 1.5rem" };
const cell: React.CSSProperties = {
  padding: "0.6rem 0.5rem",
  borderBottom: "1px solid var(--border)",
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AgentsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("agents.manage")) {
    return (
      <main style={shell}>
        <h1 style={{ fontSize: "1.4rem" }}>403 — Forbidden</h1>
        <p style={{ color: "var(--muted)" }}>You need the “Manage agents” permission.</p>
      </main>
    );
  }

  const [agents, config] = await Promise.all([agentRepository.list(), loadActiveConfig()]);

  return (
    <main style={shell}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Agents</h1>
        <Link href="/admin/agents/new" style={{ color: "var(--accent, #2563eb)" }}>
          + New agent
        </Link>
      </div>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        The agent dimension. Tenure status (new/old) and trial are derived from join date against
        the active configuration&rsquo;s thresholds
        {config
          ? ` (new < ${config.newAgentTenureDays}d, trial < ${config.trialWindowDays}d).`
          : " — no active configuration, so they cannot be derived."}
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)" }}>
            <th style={cell}>Login ID</th>
            <th style={cell}>Agent</th>
            <th style={cell}>Team leader</th>
            <th style={cell}>Join date</th>
            <th style={cell}>Tenure</th>
            <th style={cell}>Trial</th>
            <th style={cell}>Status</th>
            <th style={cell}></th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => {
            const standing = config ? deriveAgentStanding(a.joinDate, config) : null;
            return (
              <tr key={a.loginId}>
                <td style={cell}>{a.loginId}</td>
                <td style={cell}>{a.agentName}</td>
                <td style={cell}>{a.tlName}</td>
                <td style={cell}>{ymd(a.joinDate)}</td>
                <td style={cell}>
                  {standing ? (
                    <>
                      {standing.status}{" "}
                      <span style={{ color: "var(--muted)" }}>({standing.tenureDays}d)</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td style={cell}>{standing ? (standing.inTrial ? "In trial" : "—") : "—"}</td>
                <td style={cell}>
                  {a.active ? "Active" : <span style={{ color: "var(--muted)" }}>Inactive</span>}
                </td>
                <td style={cell}>
                  <Link
                    href={`/admin/agents/${a.loginId}`}
                    style={{ color: "var(--accent, #2563eb)" }}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
