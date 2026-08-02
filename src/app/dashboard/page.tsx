import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { loadActiveConfig } from "@/lib/config/loader";
import { agentRepository } from "@/lib/db/repositories";
import {
  accountLensVerified,
  agentPeriods,
  loadAgentScorecard,
} from "@/lib/dashboard/agentScorecard";
import type { LensStatus } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

const shell: React.CSSProperties = { maxWidth: 960, margin: "0 auto", padding: "2.5rem 1.5rem" };
const card: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "1.1rem 1.25rem",
  background: "var(--surface)",
};
const cell: React.CSSProperties = {
  padding: "0.5rem 0.5rem",
  borderBottom: "1px solid var(--border)",
};

function statusColor(status: LensStatus | "met" | "miss"): string {
  if (status === "pass" || status === "met") return "var(--success, #16a34a)";
  if (status === "fail" || status === "miss") return "var(--danger, #dc2626)";
  return "var(--muted)";
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  // Strict self-scope (FR-38): the dashboard only ever shows the caller's own
  // agent data. A user not linked to an agent (e.g. an Admin) has no self-view.
  const loginId = ctx.user.agentLoginId;
  if (loginId == null) {
    return (
      <main style={shell}>
        <h1 style={{ fontSize: "1.5rem" }}>My scorecard</h1>
        <p style={{ color: "var(--muted)" }}>
          Your account isn&rsquo;t linked to an agent record, so there&rsquo;s no personal scorecard
          to show.
        </p>
      </main>
    );
  }

  const [config, periods, agent] = await Promise.all([
    loadActiveConfig(),
    agentPeriods(loginId),
    agentRepository.findByLoginId(loginId),
  ]);

  const pct = (v: number) =>
    Number.isNaN(v) ? "n/a" : `${(v * 100).toFixed(config?.roundingDecimals ?? 2)}%`;

  if (!config) {
    return (
      <main style={shell}>
        <h1 style={{ fontSize: "1.5rem" }}>My scorecard</h1>
        <p style={{ color: "var(--muted)" }}>
          No active configuration, so scores can&rsquo;t be shown.
        </p>
      </main>
    );
  }

  if (periods.length === 0) {
    return (
      <main style={shell}>
        <h1 style={{ fontSize: "1.5rem" }}>My scorecard</h1>
        <p style={{ color: "var(--muted)" }}>No calls have been scored for you yet.</p>
      </main>
    );
  }

  const selected = periods.find((p) => p.label === periodParam) ?? periods[0];
  const { scorecard, calls } = await loadAgentScorecard(config, loginId, selected.id);

  return (
    <main style={shell}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.6rem", margin: 0 }}>My scorecard</h1>
        <span style={{ color: "var(--muted)" }}>{agent?.agentName ?? ctx.user.name}</span>
      </div>

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "1rem 0 1.75rem" }}>
        {periods.map((p) => {
          const active = p.id === selected.id;
          return (
            <Link
              key={p.id}
              href={`/dashboard?period=${p.label}`}
              style={{
                padding: "0.3rem 0.7rem",
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: active ? "var(--nav-active-bg)" : "transparent",
                color: active ? "var(--nav-active-fg)" : "inherit",
                fontSize: "0.85rem",
              }}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {scorecard.callCount === 0 ? (
        <p style={{ color: "var(--muted)" }}>No scored calls in {selected.label}.</p>
      ) : (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Rank */}
            <section style={card}>
              <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Agent rank</div>
              <div style={{ fontSize: "2.2rem", fontWeight: 700, lineHeight: 1.1 }}>
                {scorecard.rank}
                <span style={{ fontSize: "1rem", color: "var(--muted)", fontWeight: 400 }}>
                  {" "}
                  / 100
                </span>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0.75rem 0 0",
                  display: "grid",
                  gap: "0.3rem",
                }}
              >
                {scorecard.rankBySection.map((r) => (
                  <li
                    key={r.code}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span>
                      {r.code}{" "}
                      <span style={{ color: "var(--muted)" }}>
                        ({pct(r.accuracy)} vs {pct(r.benchmark)})
                      </span>
                    </span>
                    <span style={{ color: statusColor(r.met ? "met" : "miss") }}>
                      {r.met ? "met" : "missed"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section accuracy (Account lens) */}
            <section style={card}>
              <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                Section accuracy {accountLensVerified(config) ? "" : "(provisional)"}
              </div>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.88rem",
                  marginTop: "0.5rem",
                }}
              >
                <tbody>
                  {scorecard.sectionAccuracy.map((s) => (
                    <tr key={s.sectionId}>
                      <td style={cell}>
                        <strong>{s.code}</strong>{" "}
                        <span style={{ color: "var(--muted)" }}>{s.label}</span>
                      </td>
                      <td style={{ ...cell, textAlign: "right" }}>{pct(s.accuracy)}</td>
                      <td style={{ ...cell, textAlign: "right", color: "var(--muted)" }}>
                        {s.benchmark != null ? pct(s.benchmark) : "—"}
                      </td>
                      <td style={{ ...cell, textAlign: "right", color: statusColor(s.status) }}>
                        {s.status === "na" ? "n/a" : s.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          {/* Training recommendations */}
          <section style={card}>
            <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Training focus</div>
            {scorecard.training.length === 0 ? (
              <p style={{ color: "var(--muted)", margin: 0 }}>
                No flagged errors this period — nothing to work on. Nice.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {scorecard.training.map((t) => (
                  <li key={t.bucket}>
                    {t.bucket}{" "}
                    <span style={{ color: "var(--muted)" }}>
                      · {t.count} error{t.count === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent calls */}
          <section style={card}>
            <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              Scored calls ({scorecard.callCount})
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.evalId}>
                    <td style={cell}>{ymd(c.callDate)}</td>
                    <td
                      style={{ ...cell, color: statusColor(c.failedScorecard ? "fail" : "pass") }}
                    >
                      {c.overallStatus ?? (c.failedScorecard ? "Fail" : "Pass")}
                    </td>
                    <td style={{ ...cell, textAlign: "right" }}>
                      <Link
                        href={`/evaluations/${c.evalId}`}
                        style={{ color: "var(--nav-active-fg)" }}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </main>
  );
}
