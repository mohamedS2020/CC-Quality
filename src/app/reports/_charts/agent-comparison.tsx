import Link from "next/link";
import type { LensStatus } from "@/lib/engine/types";
import type { AgentComparisonRow } from "@/lib/reports/metrics";
import { countLabel, opportunityHelp } from "./format";

/**
 * Chart #4 — agent × section accuracy, worst-first. A status-coloured heatmap
 * table; the % is always printed in each cell, so identity never rests on colour
 * alone (colourblind-safe). Rows arrive pre-sorted worst-first.
 */

function cellBg(status: LensStatus): string {
  if (status === "pass") return "var(--success-soft)";
  if (status === "fail") return "var(--danger-soft)";
  return "var(--surface-2)";
}
function cellFg(status: LensStatus): string {
  if (status === "pass") return "var(--success)";
  if (status === "fail") return "var(--danger)";
  return "var(--muted)";
}

export function AgentComparison({
  rows,
  sections,
  decimals,
  explain = true,
  baseQuery,
}: {
  rows: AgentComparisonRow[];
  sections: { sectionId: number; code: string; perCall: number }[];
  decimals: number;
  explain?: boolean;
  baseQuery?: string;
}) {
  const pct = (v: number) => (Number.isNaN(v) ? "n/a" : `${(v * 100).toFixed(decimals)}%`);
  const center: React.CSSProperties = { textAlign: "center", fontVariantNumeric: "tabular-nums" };
  const perCallById = new Map(sections.map((s) => [s.sectionId, s]));

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table">
        <thead>
          <tr>
            <th>Agent</th>
            {sections.map((s) => (
              <th key={s.sectionId} style={{ textAlign: "center" }}>
                {s.code}
              </th>
            ))}
            <th style={{ textAlign: "center" }}>Mean</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.loginId}>
              <td style={{ whiteSpace: "nowrap" }}>
                {baseQuery ? (
                  <Link href={`/reports/detail?${baseQuery}&focus=agent&loginId=${r.loginId}`}>
                    {r.agentName}
                  </Link>
                ) : (
                  r.agentName
                )}
              </td>
              {r.cells.map((c) => {
                const frac = countLabel(c.numerator, c.denominator);
                const sm = perCallById.get(c.sectionId);
                const agentCalls =
                  sm && sm.perCall > 0 ? Math.round(c.denominator / sm.perCall) : 0;
                const tip =
                  explain && sm && c.denominator > 0
                    ? opportunityHelp(sm.code, c.numerator, c.denominator, agentCalls)
                    : undefined;
                return (
                  <td
                    key={c.sectionId}
                    title={tip}
                    style={{
                      ...center,
                      background: cellBg(c.status),
                      color: cellFg(c.status),
                      fontWeight: 600,
                    }}
                  >
                    {pct(c.accuracy)}
                    {frac && (
                      <div style={{ fontSize: "0.72rem", fontWeight: 400, opacity: 0.75 }}>
                        ({frac})
                      </div>
                    )}
                  </td>
                );
              })}
              <td style={{ ...center, fontWeight: 600 }}>{pct(r.meanAccuracy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
