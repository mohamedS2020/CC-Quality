import Link from "next/link";
import type { Report, SectionMetric } from "@/lib/reports/metrics";
import { countLabel, opportunityHelp } from "./format";

/**
 * Chart #11 — KPI tiles. A scope summary (calls, agents, pass rate + Δ) plus a
 * per-section tile carrying accuracy %, its count (x/y), the Δ vs the previous
 * period, and a pass/fail badge. Every %-tile links to its drill-down.
 */

/** A small muted "(x/y)" shown beside a percentage. */
function Count({ text }: { text: string }) {
  if (!text) return null;
  return (
    <span
      style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--muted)", marginLeft: "0.3rem" }}
    >
      ({text})
    </span>
  );
}

/** A tiny ⓘ that explains, on hover, what the count represents. */
function Info({ tip }: { tip: string }) {
  return (
    <span
      title={tip}
      aria-label={tip}
      style={{ cursor: "help", color: "var(--muted)", fontSize: "0.75rem", marginLeft: "0.3rem" }}
    >
      ⓘ
    </span>
  );
}

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

/** A tile that links to a drill-down when `href` is given, else a plain card. */
function Tile({ href, children }: { href?: string; children: React.ReactNode }) {
  return href ? (
    <Link
      className="stat"
      href={href}
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      {children}
    </Link>
  ) : (
    <div className="stat">{children}</div>
  );
}

function SectionTile({
  s,
  decimals,
  callCount,
  explain,
  baseQuery,
}: {
  s: SectionMetric;
  decimals: number;
  callCount: number;
  explain: boolean;
  baseQuery?: string;
}) {
  const badge =
    s.status === "pass"
      ? "badge badge-success"
      : s.status === "fail"
        ? "badge badge-danger"
        : "badge";
  return (
    <Tile
      href={
        baseQuery
          ? `/reports/detail?${baseQuery}&focus=section&sectionId=${s.sectionId}`
          : undefined
      }
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="stat-label">{s.code}</span>
        <span className={badge}>{s.status === "na" ? "n/a" : s.status}</span>
      </div>
      <div className="stat-value">
        {pct(s.accuracy, decimals)}
        <Count text={countLabel(s.numerator, s.denominator)} />
        {explain && s.denominator > 0 && (
          <Info tip={opportunityHelp(s.code, s.numerator, s.denominator, callCount)} />
        )}
      </div>
      <div style={{ fontSize: "0.8rem", marginTop: "0.15rem" }}>
        <Delta value={s.delta} decimals={decimals} />
      </div>
    </Tile>
  );
}

export function KpiTiles({
  report,
  decimals,
  explain = true,
  baseQuery,
}: {
  report: Report;
  decimals: number;
  explain?: boolean;
  baseQuery?: string;
}) {
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
        <Tile href={baseQuery ? `/reports/detail?${baseQuery}&focus=passrate` : undefined}>
          <div className="stat-label">Pass rate</div>
          <div className="stat-value">
            {pct(kpis.passRate, decimals)}
            <Count text={kpis.callCount > 0 ? `${kpis.passCount}/${kpis.callCount}` : ""} />
            {explain && kpis.callCount > 0 && (
              <Info
                tip={`${kpis.passCount} of ${kpis.callCount} calls passed — a call passes when it has no critical (scorecard-failing) error.`}
              />
            )}
          </div>
          <div style={{ fontSize: "0.8rem", marginTop: "0.15rem" }}>
            <Delta value={kpis.passRateDelta} decimals={decimals} />
          </div>
        </Tile>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "0.85rem",
        }}
      >
        {report.sections.map((s) => (
          <SectionTile
            key={s.sectionId}
            s={s}
            decimals={decimals}
            callCount={kpis.callCount}
            explain={explain}
            baseQuery={baseQuery}
          />
        ))}
      </div>
    </div>
  );
}
