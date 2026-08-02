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

function meterColor(status: LensStatus): string {
  if (status === "pass") return "var(--success)";
  if (status === "fail") return "var(--danger)";
  return "var(--faint)";
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

  // Strict self-scope (FR-38): only ever the caller's own agent data.
  const loginId = ctx.user.agentLoginId;
  if (loginId == null) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">My scorecard</h1>
        <p className="empty" style={{ marginTop: "1.5rem" }}>
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
      <main className="page page-narrow">
        <h1 className="page-title">My scorecard</h1>
        <p className="empty" style={{ marginTop: "1.5rem" }}>
          No active configuration, so scores can&rsquo;t be shown.
        </p>
      </main>
    );
  }

  if (periods.length === 0) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">My scorecard</h1>
        <p className="empty" style={{ marginTop: "1.5rem" }}>
          No calls have been scored for you yet — check back after your first review.
        </p>
      </main>
    );
  }

  const selected = periods.find((p) => p.label === periodParam) ?? periods[0];
  const { scorecard, calls } = await loadAgentScorecard(config, loginId, selected.id);

  return (
    <main className="page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div>
          <h1 className="page-title" style={{ fontSize: "1.7rem" }}>
            My scorecard
          </h1>
          <p className="page-sub">{agent?.agentName ?? ctx.user.name}</p>
        </div>
      </div>

      <div
        style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "1.25rem 0 1.75rem" }}
      >
        {periods.map((p) => {
          const active = p.id === selected.id;
          return (
            <Link
              key={p.id}
              href={`/dashboard?period=${p.label}`}
              className={active ? "badge badge-accent" : "badge"}
              style={{ padding: "0.3rem 0.7rem", fontWeight: 500 }}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {scorecard.callCount === 0 ? (
        <p className="empty">No scored calls in {selected.label}.</p>
      ) : (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Rank */}
            <section className="card">
              <div className="stat-label">Agent rank</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "0.35rem",
                  margin: "0.15rem 0 0.9rem",
                }}
              >
                <span
                  style={{
                    fontSize: "2.6rem",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                  }}
                >
                  {scorecard.rank}
                </span>
                <span className="muted" style={{ fontSize: "1rem" }}>
                  / 100
                </span>
              </div>
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${scorecard.rank}%` }} />
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "1rem 0 0",
                  display: "grid",
                  gap: "0.45rem",
                }}
              >
                {scorecard.rankBySection.map((r) => (
                  <li
                    key={r.code}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.86rem",
                    }}
                  >
                    <span>
                      <strong>{r.code}</strong>{" "}
                      <span className="muted">
                        {pct(r.accuracy)} vs {pct(r.benchmark)}
                      </span>
                    </span>
                    <span className={r.met ? "badge badge-success" : "badge badge-danger"}>
                      {r.met ? "met" : "missed"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section accuracy (Account lens) */}
            <section className="card">
              <div className="stat-label" style={{ marginBottom: "0.85rem" }}>
                Section accuracy {accountLensVerified(config) ? "" : "(provisional)"}
              </div>
              <div style={{ display: "grid", gap: "0.85rem" }}>
                {scorecard.sectionAccuracy.map((s) => {
                  const filled = Number.isNaN(s.accuracy) ? 0 : Math.round(s.accuracy * 100);
                  return (
                    <div key={s.sectionId}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.86rem",
                          marginBottom: "0.3rem",
                        }}
                      >
                        <span>
                          <strong>{s.code}</strong> <span className="muted">{s.label}</span>
                        </span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>
                          {pct(s.accuracy)}
                        </span>
                      </div>
                      <div className="meter" aria-hidden="true">
                        <span style={{ width: `${filled}%`, background: meterColor(s.status) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Training focus */}
          <section className="card">
            <div style={{ fontWeight: 600, marginBottom: "0.7rem" }}>Training focus</div>
            {scorecard.training.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No flagged errors this period — nothing to work on. Nice work. ✦
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {scorecard.training.map((t) => (
                  <span
                    key={t.bucket}
                    className="badge badge-warning"
                    style={{ padding: "0.3rem 0.7rem" }}
                  >
                    {t.bucket} · {t.count}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Scored calls */}
          <section className="card" style={{ padding: "0.5rem 0.5rem 0.25rem" }}>
            <div style={{ fontWeight: 600, padding: "0.75rem 0.85rem 0.5rem" }}>
              Scored calls <span className="muted">({scorecard.callCount})</span>
            </div>
            <table className="table">
              <tbody>
                {calls.map((c) => (
                  <tr key={c.evalId}>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{ymd(c.callDate)}</td>
                    <td>
                      <span
                        className={c.failedScorecard ? "badge badge-danger" : "badge badge-success"}
                      >
                        {c.overallStatus ?? (c.failedScorecard ? "Fail" : "Pass")}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link href={`/evaluations/${c.evalId}`}>View →</Link>
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
