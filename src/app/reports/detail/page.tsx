import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { loadActiveConfig } from "@/lib/config/loader";
import { reportPeriods } from "@/lib/reports/filters";
import { loadReport, pickLens } from "@/lib/reports/metrics";
import { previousPeriodId, resolveScope, resolveWindow } from "@/lib/reports/resolve";
import {
  loadCallDetails,
  rankBreakdown,
  scoreCall,
  type CallDetailRow,
} from "@/lib/reports/detail";
import { countLabel } from "../_charts/format";
import { CallsTable } from "./calls-table";

export const dynamic = "force-dynamic";

type Params = {
  scope?: string;
  tl?: string;
  agent?: string;
  period?: string;
  lens?: string;
  from?: string;
  to?: string;
  focus?: string;
  sectionId?: string;
  loginId?: string;
};

function shell(children: React.ReactNode) {
  return (
    <main className="page">
      <h1 className="page-title">Report detail</h1>
      {children}
    </main>
  );
}

const fpct = (v: number | undefined, d: number) =>
  v == null || Number.isNaN(v) ? "n/a" : `${(v * 100).toFixed(d)}%`;

export default async function ReportDetailPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctx.permissions.has("reports.view")) {
    return shell(<p className="empty">You need the “View reports” permission.</p>);
  }

  const config = await loadActiveConfig();
  if (!config) return shell(<p className="empty">No active configuration.</p>);
  const periods = await reportPeriods();
  if (periods.length === 0) return shell(<p className="empty">No calls have been scored yet.</p>);

  const selectedPeriod = periods.find((p) => p.label === params.period) ?? periods[0];
  // Same window resolution as /reports, so a drill-down always matches its chart.
  const { window } = resolveWindow(params, {
    periodId: selectedPeriod.id,
    previousPeriodId: previousPeriodId(periods, selectedPeriod.id),
    label: selectedPeriod.label,
  });
  // Agents are pinned to the Agent lens and never shown calculation internals.
  const explain = ctx.user.role !== "AGENT";
  const lens = pickLens(config, explain ? params.lens : "agent");
  if (!lens) return shell(<p className="empty">No lenses are configured.</p>);

  const sr = resolveScope(params, { role: ctx.user.role, agentLoginId: ctx.user.agentLoginId });
  if (!sr.ok) return shell(<p className="empty">{sr.message}</p>);

  const [report, details] = await Promise.all([
    loadReport(config, lens, sr.scope, window),
    loadCallDetails(config, sr.scope, window.current),
  ]);

  const decimals = config.roundingDecimals;
  const sectionMeta = config.sections.map((s) => ({ sectionId: s.id, code: s.code }));

  // Preserve the current filters when linking back to /reports.
  const back = new URLSearchParams();
  back.set("scope", sr.kind);
  if (window.from && window.to) {
    back.set("from", window.from);
    back.set("to", window.to);
  } else {
    back.set("period", selectedPeriod.label);
  }
  back.set("lens", lens.key);
  if (sr.kind === "tl" && sr.tl) back.set("tl", sr.tl);
  if (sr.kind === "agent" && sr.agentLoginId != null) back.set("agent", String(sr.agentLoginId));

  const focus = params.focus ?? "overview";
  const focusSectionId = params.sectionId ? Number(params.sectionId) : undefined;
  const focusLoginId = params.loginId ? Number(params.loginId) : undefined;

  // For a section drill-down, show only calls that had an error in that section
  // (each still shows all its sections + flags, so cross-section failures appear).
  const focusSectionCode =
    focusSectionId != null
      ? (config.sections.find((s) => s.id === focusSectionId)?.code ?? "")
      : "";
  const failedInSection =
    focus === "section" && focusSectionId != null
      ? details.filter(
          (d) => (d.sections.find((sc) => sc.sectionId === focusSectionId)?.errorCount ?? 0) > 0,
        )
      : [];

  const scopeLabel =
    sr.kind === "account" ? "Whole account" : sr.kind === "tl" ? `Team ${sr.tl}` : "Agent";

  return (
    <main className="page">
      <Link
        href={`/reports?${back}`}
        className="btn btn-ghost btn-sm no-print"
        style={{ marginBottom: "0.5rem" }}
      >
        ← Back to reports
      </Link>
      <h1 className="page-title">Report detail</h1>
      <p className="page-sub">
        {scopeLabel} · {window.label} · {lens.label} lens · {details.length} calls
      </p>

      <div style={{ display: "grid", gap: "1.5rem", marginTop: "1rem" }}>
        {focus === "section" && focusSectionId != null && (
          <SectionFocus
            report={report}
            sectionId={focusSectionId}
            decimals={decimals}
            explain={explain}
          />
        )}
        {focus === "passrate" && <PassRateFocus report={report} decimals={decimals} />}
        {focus === "leaderboard" && (
          <LeaderboardFocus
            config={config}
            details={details}
            decimals={decimals}
            explain={explain}
          />
        )}
        {focus === "agent" && focusLoginId != null && (
          <AgentFocus
            config={config}
            details={details}
            loginId={focusLoginId}
            decimals={decimals}
            explain={explain}
          />
        )}

        {focus === "section" && focusSectionId != null ? (
          <section className="card">
            <strong>
              Calls with a {focusSectionCode} error ({failedInSection.length})
            </strong>
            <p className="muted" style={{ fontSize: "0.85rem", margin: "0.15rem 0 0.75rem" }}>
              Only calls flagged in {focusSectionCode}. Each row still shows every section and all
              flags on that call, so a call that also failed another section appears here too.
            </p>
            <CallsTable
              rows={failedInSection}
              sections={sectionMeta}
              decimals={decimals}
              highlightSectionId={focusSectionId}
            />
          </section>
        ) : focus !== "agent" ? (
          /* Full raw data behind the report (agent focus shows only its own calls above). */
          <section className="card">
            <strong>All calls in scope</strong>
            <p className="muted" style={{ fontSize: "0.85rem", margin: "0.15rem 0 0.75rem" }}>
              Every figure on the report is an aggregate of these {details.length} calls.
            </p>
            <CallsTable rows={details} sections={sectionMeta} decimals={decimals} />
          </section>
        ) : null}
      </div>
    </main>
  );
}

// --- Focus blocks -----------------------------------------------------------

function SectionFocus({
  report,
  sectionId,
  decimals,
  explain,
}: {
  report: Awaited<ReturnType<typeof loadReport>>;
  sectionId: number;
  decimals: number;
  explain: boolean;
}) {
  const s = report.sections.find((x) => x.sectionId === sectionId);
  if (!s) return null;
  const frac = countLabel(s.numerator, s.denominator);
  return (
    <section className="card">
      <strong>
        {s.code} — {s.label}
      </strong>
      <div style={{ fontSize: "1.6rem", fontWeight: 500, margin: "0.35rem 0" }}>
        {fpct(s.accuracy, decimals)}{" "}
        {frac && (
          <span className="muted" style={{ fontSize: "1rem" }}>
            ({frac})
          </span>
        )}
      </div>
      <p className="muted" style={{ fontSize: "0.9rem", margin: 0 }}>
        {explain && (
          <>
            Accuracy = 1 − errors/opportunities → {frac ? `${frac} passing units` : "no data"}
            {s.benchmark != null && (
              <>
                {" "}
                · benchmark {fpct(s.benchmark, decimals)} → <strong>{s.status}</strong>
              </>
            )}
            .{" "}
          </>
        )}
        Only calls with a <strong>{s.code}</strong> error are listed below.
      </p>
    </section>
  );
}

function PassRateFocus({
  report,
  decimals,
}: {
  report: Awaited<ReturnType<typeof loadReport>>;
  decimals: number;
}) {
  const k = report.kpis;
  return (
    <section className="card">
      <strong>Pass rate</strong>
      <div style={{ fontSize: "1.6rem", fontWeight: 500, margin: "0.35rem 0" }}>
        {fpct(k.passRate, decimals)}{" "}
        <span className="muted" style={{ fontSize: "1rem" }}>
          ({k.passCount}/{k.callCount})
        </span>
      </div>
      <p className="muted" style={{ fontSize: "0.9rem", margin: 0 }}>
        A call passes when it has no critical (scorecard-failing) error. {k.passCount} of{" "}
        {k.callCount} calls passed — see the <strong>Result</strong> column below.
      </p>
    </section>
  );
}

function RankTable({
  breakdown,
  decimals,
}: {
  breakdown: ReturnType<typeof rankBreakdown>;
  decimals: number;
}) {
  return (
    <table className="table" style={{ maxWidth: 560 }}>
      <thead>
        <tr>
          <th>Section</th>
          <th style={{ textAlign: "center" }}>Accuracy</th>
          <th style={{ textAlign: "center" }}>Benchmark</th>
          <th style={{ textAlign: "center" }}>Weight</th>
          <th style={{ textAlign: "center" }}>Earned</th>
        </tr>
      </thead>
      <tbody>
        {breakdown.sections.map((s) => (
          <tr key={s.sectionId}>
            <td>{s.code}</td>
            <td style={{ textAlign: "center" }}>{fpct(s.accuracy, decimals)}</td>
            <td style={{ textAlign: "center" }}>{fpct(s.rankBenchmark, decimals)}</td>
            <td style={{ textAlign: "center" }}>{s.weight}</td>
            <td
              style={{
                textAlign: "center",
                fontWeight: 600,
                color: s.met ? "var(--success)" : "var(--danger)",
              }}
            >
              {s.met ? `+${s.earned}` : "0"}
            </td>
          </tr>
        ))}
        <tr>
          <td colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>
            Rank
          </td>
          <td style={{ textAlign: "center", fontWeight: 700 }}>{breakdown.rank}</td>
        </tr>
      </tbody>
    </table>
  );
}

function AgentFocus({
  config,
  details,
  loginId,
  decimals,
  explain,
}: {
  config: Awaited<ReturnType<typeof loadActiveConfig>>;
  details: CallDetailRow[];
  loginId: number;
  decimals: number;
  explain: boolean;
}) {
  if (!config) return null;
  const rows = details.filter((d) => d.agentLoginId === loginId);
  if (rows.length === 0) return <p className="empty">No calls for this agent in scope.</p>;
  const sectionMeta = config.sections.map((s) => ({ sectionId: s.id, code: s.code }));

  return (
    <>
      {explain && (
        <section className="card">
          {(() => {
            const bd = rankBreakdown(
              config,
              rows.map((d) => scoreCall(config, d.reasonIds)),
            );
            return (
              <>
                <strong>
                  {rows[0].agentName} — rank {bd.rank}
                </strong>
                <p className="muted" style={{ fontSize: "0.85rem", margin: "0.15rem 0 0.75rem" }}>
                  Each section earns its full weight only when the agent’s accuracy meets its
                  benchmark.
                </p>
                <RankTable breakdown={bd} decimals={decimals} />
              </>
            );
          })()}
        </section>
      )}
      <section className="card">
        <strong>
          {rows[0].agentName}’s calls ({rows.length})
        </strong>
        <div style={{ marginTop: "0.5rem" }}>
          <CallsTable rows={rows} sections={sectionMeta} decimals={decimals} />
        </div>
      </section>
    </>
  );
}

function LeaderboardFocus({
  config,
  details,
  decimals,
  explain,
}: {
  config: Awaited<ReturnType<typeof loadActiveConfig>>;
  details: CallDetailRow[];
  decimals: number;
  explain: boolean;
}) {
  // Rank-computation breakdown is a manager view (calculation-heavy); hide for agents.
  if (!config || !explain) return null;
  const byAgent = new Map<number, CallDetailRow[]>();
  for (const d of details) {
    const list = byAgent.get(d.agentLoginId);
    if (list) list.push(d);
    else byAgent.set(d.agentLoginId, [d]);
  }
  const agents = [...byAgent.entries()]
    .map(([id, rows]) => ({
      loginId: id,
      name: rows[0].agentName,
      bd: rankBreakdown(
        config,
        rows.map((d) => scoreCall(config, d.reasonIds)),
      ),
    }))
    .sort((a, b) => b.bd.rank - a.bd.rank);

  return (
    <section className="card">
      <strong>Leaderboard — how each rank was earned</strong>
      <p className="muted" style={{ fontSize: "0.85rem", margin: "0.15rem 0 0.75rem" }}>
        Each cell is the agent’s section accuracy; a met benchmark earns that section’s weight.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Agent</th>
              {config.sections.map((s) => (
                <th key={s.id} style={{ textAlign: "center" }}>
                  {s.code} <span className="muted">({s.rankWeight})</span>
                </th>
              ))}
              <th style={{ textAlign: "center" }}>Rank</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.loginId}>
                <td style={{ whiteSpace: "nowrap" }}>{a.name}</td>
                {a.bd.sections.map((s) => (
                  <td
                    key={s.sectionId}
                    style={{
                      textAlign: "center",
                      color: s.met ? "var(--success)" : "var(--danger)",
                      fontWeight: 600,
                    }}
                  >
                    {fpct(s.accuracy, decimals)} {s.met ? "✓" : "✗"}
                  </td>
                ))}
                <td style={{ textAlign: "center", fontWeight: 700 }}>{a.bd.rank}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
