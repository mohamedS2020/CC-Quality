import type { Report, SectionMetric } from "@/lib/reports/metrics";

/**
 * Chart #11 — KPI tiles. A scope summary (calls, agents, pass rate + Δ) plus a
 * per-section tile carrying accuracy %, the Δ vs the previous period, and a
 * pass/fail badge.
 */

function Delta({ value, decimals }: { value: number | null; decimals: number }) {
  if (value == null) return <span className="muted">no prior period</span>;
  const pts = Number((value * 100).toFixed(decimals));
  if (pts === 0) return <span className="muted">no change</span>;
  const up = pts > 0;
  return (
    <span style={{ color: up ? "var(--success)" : "var(--danger)" }}>
      {up ? "▲" : "▼"} {Math.abs(pts)} pts
    </span>
  );
}

function pct(v: number | undefined, decimals: number): string {
  return v == null || Number.isNaN(v) ? "n/a" : `${(v * 100).toFixed(decimals)}%`;
}

function SectionTile({ s, decimals }: { s: SectionMetric; decimals: number }) {
  const badge =
    s.status === "pass"
      ? "badge badge-success"
      : s.status === "fail"
        ? "badge badge-danger"
        : "badge";
  return (
    <div className="stat">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="stat-label">{s.code}</span>
        <span className={badge}>{s.status === "na" ? "n/a" : s.status}</span>
      </div>
      <div className="stat-value">{pct(s.accuracy, decimals)}</div>
      <div style={{ fontSize: "0.8rem", marginTop: "0.15rem" }}>
        <Delta value={s.delta} decimals={decimals} />
      </div>
    </div>
  );
}

export function KpiTiles({ report, decimals }: { report: Report; decimals: number }) {
  const { kpis } = report;
  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "0.85rem",
        }}
      >
        <div className="stat">
          <div className="stat-label">Calls scored</div>
          <div className="stat-value">{kpis.callCount}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Agents</div>
          <div className="stat-value">{kpis.agentCount}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Pass rate</div>
          <div className="stat-value">{pct(kpis.passRate, decimals)}</div>
          <div style={{ fontSize: "0.8rem", marginTop: "0.15rem" }}>
            <Delta value={kpis.passRateDelta} decimals={decimals} />
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "0.85rem",
        }}
      >
        {report.sections.map((s) => (
          <SectionTile key={s.sectionId} s={s} decimals={decimals} />
        ))}
      </div>
    </div>
  );
}
