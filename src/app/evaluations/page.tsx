import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { listCurrentEvaluations } from "@/lib/evaluations/query";

export const dynamic = "force-dynamic";

const shell: React.CSSProperties = { maxWidth: 1000, margin: "0 auto", padding: "2.5rem 1.5rem" };
const cell: React.CSSProperties = {
  padding: "0.6rem 0.5rem",
  borderBottom: "1px solid var(--border)",
};

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function EvaluationsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("evaluations.view")) {
    return (
      <main style={shell}>
        <h1 style={{ fontSize: "1.4rem" }}>403 — Forbidden</h1>
        <p style={{ color: "var(--muted)" }}>You need the “View evaluations” permission.</p>
      </main>
    );
  }

  const evaluations = await listCurrentEvaluations();

  return (
    <main style={shell}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Evaluations</h1>
        {ctx.permissions.has("evaluations.create") && (
          <Link href="/evaluations/new" style={{ color: "var(--accent, #2563eb)" }}>
            + New score sheet
          </Link>
        )}
      </div>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        The current version of every scored call. Corrected calls show their latest version; open
        one to see its full history.
      </p>

      {evaluations.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No evaluations yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)" }}>
              <th style={cell}>Call date</th>
              <th style={cell}>Agent</th>
              <th style={cell}>QA owner</th>
              <th style={cell}>Result</th>
              <th style={cell}>Version</th>
              <th style={cell}></th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((e) => (
              <tr key={e.evalId}>
                <td style={cell}>{fmtDate(e.callDate)}</td>
                <td style={cell}>{e.agent.agentName}</td>
                <td style={cell}>{e.qaOwner}</td>
                <td style={cell}>
                  <span
                    style={{
                      color: e.failedScorecard
                        ? "var(--danger, #b91c1c)"
                        : "var(--success, #2e7d32)",
                    }}
                  >
                    {e.overallStatus ?? (e.failedScorecard ? "Fail" : "Pass")}
                  </span>
                </td>
                <td style={cell}>
                  v{e.version}
                  {e.version > 1 && <span style={{ color: "var(--muted)" }}> · corrected</span>}
                </td>
                <td style={cell}>
                  <Link
                    href={`/evaluations/${e.evalId}`}
                    style={{ color: "var(--accent, #2563eb)" }}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
