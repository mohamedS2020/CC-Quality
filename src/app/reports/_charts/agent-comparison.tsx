import type { LensStatus } from "@/lib/engine/types";
import type { AgentComparisonRow } from "@/lib/reports/metrics";

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
}: {
  rows: AgentComparisonRow[];
  sections: { sectionId: number; code: string }[];
  decimals: number;
}) {
  const pct = (v: number) => (Number.isNaN(v) ? "n/a" : `${(v * 100).toFixed(decimals)}%`);
  const center: React.CSSProperties = { textAlign: "center", fontVariantNumeric: "tabular-nums" };

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
              <td style={{ whiteSpace: "nowrap" }}>{r.agentName}</td>
              {r.cells.map((c) => (
                <td
                  key={c.sectionId}
                  style={{
                    ...center,
                    background: cellBg(c.status),
                    color: cellFg(c.status),
                    fontWeight: 600,
                  }}
                >
                  {pct(c.accuracy)}
                </td>
              ))}
              <td style={{ ...center, fontWeight: 600 }}>{pct(r.meanAccuracy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
