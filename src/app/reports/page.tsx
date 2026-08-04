import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { loadActiveConfig } from "@/lib/config/loader";
import { isLensProvisional } from "@/lib/engine/lenses";
import { reportAgents, reportPeriods, teamLeads } from "@/lib/reports/filters";
import { loadReport, pickLens, type Report } from "@/lib/reports/metrics";
import { previousPeriodId, resolveScope } from "@/lib/reports/resolve";
import { ReportFilters, type FilterValues } from "./report-filters";
import { PrintButton } from "./print-button";
import { KpiTiles } from "./_charts/kpi-tiles";
import { SectionBenchmarkChart } from "./_charts/section-benchmark-chart";
import { AgentComparison } from "./_charts/agent-comparison";
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
  const prevId = previousPeriodId(periods, selectedPeriod.id);

  const lens = pickLens(config, params.lens);
  if (!lens) return shell(<p className="empty">No lenses are configured.</p>);

  const canExport = ctx.permissions.has("reports.export");
  const isAgent = ctx.user.role === "AGENT";
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
  };

  const report: Report | null = sr.ok
    ? await loadReport(config, lens, sr.scope, selectedPeriod.id, prevId)
    : null;

  const scopeLabel =
    sr.kind === "account"
      ? "Whole account"
      : sr.kind === "tl"
        ? `Team ${sr.tl ?? "—"}`
        : `Agent ${options.agents.find((a) => a.loginId === sr.agentLoginId)?.agentName ?? sr.agentLoginId ?? "—"}`;

  const exportQuery = new URLSearchParams();
  exportQuery.set("scope", values.scope);
  exportQuery.set("period", values.period);
  exportQuery.set("lens", values.lens);
  if (values.scope === "tl" && values.tl) exportQuery.set("tl", values.tl);
  if (values.scope === "agent" && values.agentLoginId != null)
    exportQuery.set("agent", String(values.agentLoginId));

  const sectionMeta = config.sections.map((s) => ({ sectionId: s.id, code: s.code }));
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
            {scopeLabel} · {selectedPeriod.label}
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
            <PrintButton />
          </div>
        )}
      </div>

      <div className="no-print" style={{ margin: "1.25rem 0" }}>
        <ReportFilters options={options} values={values} lockScope={isAgent} />
      </div>

      {report && report.lensProvisional && (
        <p className="badge badge-warning" style={{ marginBottom: "1rem" }}>
          Provisional lens — this basis isn’t reconciled yet
        </p>
      )}

      {!sr.ok ? (
        <p className="empty">{sr.message}</p>
      ) : report && report.kpis.callCount === 0 ? (
        <p className="empty">No scored calls for this scope in {selectedPeriod.label}.</p>
      ) : report ? (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <KpiTiles report={report} decimals={config.roundingDecimals} />

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
            <SectionBenchmarkChart sections={report.sections} decimals={config.roundingDecimals} />
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
                />
              </section>

              <section className="card">
                <strong>Leaderboard</strong>
                <p className="muted" style={{ fontSize: "0.85rem", margin: "0.1rem 0 0.9rem" }}>
                  Agent rank (0–100), best first.
                </p>
                <Leaderboard rows={report.leaderboard} />
              </section>
            </>
          )}
        </div>
      ) : null}
    </main>
  );
}
