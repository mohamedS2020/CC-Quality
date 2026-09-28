import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { loadActiveConfig } from "@/lib/config/loader";
import { isLensProvisional } from "@/lib/engine/lenses";
import { reportAgents, reportPeriods, teamLeads } from "@/lib/reports/filters";
import { loadReport, pickLens, type Report } from "@/lib/reports/metrics";
import { previousPeriodId, resolveScope, resolveWindow } from "@/lib/reports/resolve";
import { ReportFilters, type FilterValues } from "./report-filters";
import { KpiTiles } from "./_charts/kpi-tiles";
import { SectionBenchmarkChart } from "./_charts/section-benchmark-chart";
import { AgentComparison } from "./_charts/agent-comparison";
import { FiguresPerAgent } from "./_charts/figures-per-agent";
import { Leaderboard } from "./_charts/leaderboard-chart";

export const dynamic = "force-dynamic";

const Legend = () => (
  <div
    style={{
      display: "flex",
      gap: "1rem",
      flexWrap: "wrap",
      fontSize: "0.8rem",
      color: "var(--muted)",
    }}
  >
    <span>
      <span style={{ color: "var(--success)" }}>■</span> meets benchmark
    </span>
    <span>
      <span style={{ color: "var(--danger)" }}>■</span> below benchmark
    </span>
    <span>┄ benchmark</span>
  </div>
);

function shell(children: React.ReactNode) {
  return (
    <main className="page page-narrow">
      <h1 className="page-title">Reports</h1>
      {children}
    </main>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: string;
    tl?: string;
    agent?: string;
    period?: string;
    lens?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("reports.view")) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">403 — Forbidden</h1>
        <p className="page-sub">You need the “View reports” permission.</p>
      </main>
    );
  }

  const config = await loadActiveConfig();
  if (!config)
    return shell(
      <p className="empty">No active configuration, so there is nothing to report on.</p>,
    );

  const periods = await reportPeriods();
  if (periods.length === 0) return shell(<p className="empty">No calls have been scored yet.</p>);

  const selectedPeriod = periods.find((p) => p.label === params.period) ?? periods[0];
  // A custom From/To range wins over the period preset; bad input falls back to it.
  const { window, invalid } = resolveWindow(params, {
    periodId: selectedPeriod.id,
    previousPeriodId: previousPeriodId(periods, selectedPeriod.id),
    label: selectedPeriod.label,
  });

  const isAgent = ctx.user.role === "AGENT";
  // Agents are pinned to the Agent lens (their own view); everyone else may pick.
  const lens = pickLens(config, isAgent ? "agent" : params.lens);
  if (!lens) return shell(<p className="empty">No lenses are configured.</p>);

  const canExport = ctx.permissions.has("reports.export");
  const sr = resolveScope(params, { role: ctx.user.role, agentLoginId: ctx.user.agentLoginId });

  if (!sr.ok && sr.reason === "no-agent-link") {
    return shell(<p className="empty">{sr.message}</p>);
  }

  const [tls, agents] = await Promise.all([teamLeads(), reportAgents()]);
  const options = {
    periods,
    teamLeads: tls,
    agents: agents.map((a) => ({ loginId: a.loginId, agentName: a.agentName })),
    lenses: config.lenses.map((l) => ({
      key: l.key,
      label: l.label,
      provisional: isLensProvisional(l.basis),
    })),
  };

  const values: FilterValues = {
    scope: sr.kind,
    tl: sr.tl,
    agentLoginId: sr.agentLoginId,
    period: selectedPeriod.label,
    lens: lens.key,
    from: window.from,
    to: window.to,
  };

  const report: Report | null = sr.ok ? await loadReport(config, lens, sr.scope, window) : null;

  const scopeLabel =
    sr.kind === "account"
      ? "Whole account"
      : sr.kind === "tl"
        ? `Team ${sr.tl ?? "—"}`
        : `Agent ${options.agents.find((a) => a.loginId === sr.agentLoginId)?.agentName ?? sr.agentLoginId ?? "—"}`;

  // Exports and drill-downs must inherit the SAME window, or "the data behind the
  // report" would silently revert to the month preset.
  const exportQuery = new URLSearchParams();
  exportQuery.set("scope", values.scope);
  if (window.from && window.to) {
    exportQuery.set("from", window.from);
    exportQuery.set("to", window.to);
  } else {
    exportQuery.set("period", values.period);
  }
  exportQuery.set("lens", values.lens);
  if (values.scope === "tl" && values.tl) exportQuery.set("tl", values.tl);
  if (values.scope === "agent" && values.agentLoginId != null)
    exportQuery.set("agent", String(values.agentLoginId));

  const callCount = report?.kpis.callCount ?? 0;
  const sectionMeta = config.sections.map((s) => {
    const m = report?.sections.find((x) => x.sectionId === s.id);
    const perCall = m && callCount > 0 ? Math.max(1, Math.round(m.denominator / callCount)) : 1;
    return { sectionId: s.id, code: s.code, perCall };
  });
  const figureSections = config.sections.map((s) => ({
    sectionId: s.id,
    code: s.code,
    label: s.label,
  }));
  const detailBase = exportQuery.toString();
  const showAgentCharts = !!report && report.agentComparison.length > 1;

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
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">
            {scopeLabel} · {window.label}
          </p>
        </div>
        {canExport && report && (
          <div className="no-print" style={{ display: "flex", gap: "0.5rem" }}>
            <Link
              href={`/reports/export?format=csv&${exportQuery}`}
              className="btn btn-ghost btn-sm"
            >
              CSV
            </Link>
            <Link
              href={`/reports/export?format=xlsx&${exportQuery}`}
              className="btn btn-ghost btn-sm"
            >
              Excel
            </Link>
            <Link
              href={`/reports/export?format=pdf&${exportQuery}`}
              className="btn btn-ghost btn-sm"
            >
              PDF
            </Link>
          </div>
        )}
      </div>

      <div className="no-print" style={{ margin: "1.25rem 0" }}>
        <ReportFilters options={options} values={values} lockScope={isAgent} lockLens={isAgent} />
      </div>

      {invalid && (
        <p className="badge badge-warning" style={{ marginBottom: "1rem" }}>
          {invalid} Showing {selectedPeriod.label} instead.
        </p>
      )}

      {report && report.unresolvedFlags > 0 && (
        <p className="badge badge-danger" style={{ marginBottom: "1rem" }}>
          {report.unresolvedFlags} flagged{" "}
          {report.unresolvedFlags === 1 ? "error is" : "errors are"} no longer in the active rubric,
          so the figures below understate errors. Restore the removed reason(s) in Configuration, or
          re-score the affected calls.
        </p>
      )}

      {!isAgent && report && report.lensProvisional && (
        <p className="badge badge-warning" style={{ marginBottom: "1rem" }}>
          Provisional lens — this basis isn’t reconciled yet
        </p>
      )}

      {!sr.ok ? (
        <p className="empty">{sr.message}</p>
      ) : report && report.kpis.callCount === 0 ? (
        <p className="empty">No scored calls for this scope in {window.label}.</p>
      ) : report ? (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <KpiTiles
            report={report}
            decimals={config.roundingDecimals}
            explain={!isAgent}
            baseQuery={detailBase}
          />

          <section className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: "0.5rem",
              }}
            >
              <strong>Section accuracy vs benchmark</strong>
              <Legend />
            </div>
            <SectionBenchmarkChart
              sections={report.sections}
              decimals={config.roundingDecimals}
              callCount={report.kpis.callCount}
              explain={!isAgent}
              baseQuery={detailBase}
            />
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
              <Link href={`/reports/detail?${detailBase}&focus=overview`}>
                View all underlying call data →
              </Link>
            </p>
          </section>

          {showAgentCharts && (
            <>
              <section className="card">
                <strong>Agent comparison</strong>
                <p className="muted" style={{ fontSize: "0.85rem", margin: "0.1rem 0 0.75rem" }}>
                  Per-section accuracy, worst-first.
                </p>
                <AgentComparison
                  rows={report.agentComparison}
                  sections={sectionMeta}
                  decimals={config.roundingDecimals}
                  explain={!isAgent}
                  baseQuery={detailBase}
                />

                <div style={{ marginTop: "1.5rem" }}>
                  <strong>Figures per agent</strong>
                  <p className="muted" style={{ fontSize: "0.85rem", margin: "0.1rem 0 0.75rem" }}>
                    The same numbers as above, one column per section. Click a column for that
                    agent&apos;s calls.
                  </p>
                  <FiguresPerAgent
                    rows={report.agentComparison}
                    sections={figureSections}
                    decimals={config.roundingDecimals}
                    baseQuery={detailBase}
                  />
                </div>
              </section>

              <section className="card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <strong>Leaderboard</strong>
                  <Link
                    href={`/reports/detail?${detailBase}&focus=leaderboard`}
                    style={{ fontSize: "0.85rem" }}
                  >
                    How ranks are computed →
                  </Link>
                </div>
                <p className="muted" style={{ fontSize: "0.85rem", margin: "0.1rem 0 0.9rem" }}>
                  Agent rank (0–100), best first. Click an agent for their breakdown.
                </p>
                <Leaderboard rows={report.leaderboard} baseQuery={detailBase} />
              </section>
            </>
          )}
        </div>
      ) : null}
    </main>
  );
}
