import type { AgentComparisonRow } from "@/lib/reports/metrics";
import { countLabel } from "./format";

/**
 * Chart #6 — "Figures per agent": a grouped column chart of agent × section
 * accuracy, one coloured column per section within each agent's group.
 *
 * Colour carries SECTION identity (categorical), assigned by fixed slot order
 * from the `--series-*` tokens so a section keeps its colour however the agent
 * set changes — it never encodes pass/fail here. Because identity must not rest
 * on colour alone, every column is directly labelled with its value and the
 * Agent comparison table above holds the same numbers.
 *
 * The value axis starts at 50%, matching how a spreadsheet auto-scales this
 * data: QA accuracy clusters in the 90–100% band, where a 0-based axis renders
 * every column the same height. The floor drops to 0 the moment any value falls
 * below it, so a column is never clipped, and the axis labels the floor plainly.
 */

const PAD_L = 46;
const PAD_R = 14;
const PAD_T = 26;
const PAD_B = 58;
const PLOT_H = 232;
const H = PAD_T + PLOT_H + PAD_B;
const BAR_GAP = 2; // surface gap between adjacent columns
// Wide enough that a "100.0%" label sits over its own column without touching
// its neighbour's — the label, not the bar, sets the minimum pitch.
const MAX_BAR = 42;
const LABEL_SIZE = 9;

export interface FigureSection {
  sectionId: number;
  code: string;
  label: string;
}

/** Fixed slot order — never cycled; beyond slot 8 a section falls back to neutral. */
const seriesColor = (i: number) => (i < 8 ? `var(--series-${i + 1})` : "var(--faint)");

export function FiguresPerAgent({
  rows,
  sections,
  decimals,
  baseQuery,
}: {
  rows: AgentComparisonRow[];
  sections: FigureSection[];
  decimals: number;
  baseQuery?: string;
}) {
  if (rows.length === 0 || sections.length === 0) return null;

  const pct = (v: number) => (Number.isNaN(v) ? "n/a" : `${(v * 100).toFixed(decimals)}%`);
  // Column labels cap at 1 decimal so they fit above their own column; the table
  // above and the tooltip below carry the full configured precision.
  const labelDecimals = Math.min(decimals, 1);
  const label = (v: number) => (Number.isNaN(v) ? "n/a" : `${(v * 100).toFixed(labelDecimals)}%`);

  const values = rows
    .flatMap((r) => r.cells.map((c) => c.accuracy))
    .filter((v) => !Number.isNaN(v));
  const min = values.length > 0 ? Math.min(...values) : 1;
  const floor = min < 0.5 ? 0 : 0.5;
  const span = 1 - floor;
  const y = (v: number) => PAD_T + PLOT_H * (1 - (v - floor) / span);

  const ticks: number[] = [];
  for (let t = floor; t <= 1.0001; t += span / 5) ticks.push(Number(t.toFixed(4)));

  // Size the group to the series count so columns stay legible, then let the
  // container scroll rather than squashing them when there are many agents.
  const groupW = Math.max(96, sections.length * (MAX_BAR + BAR_GAP) + 34);
  const W = PAD_L + PAD_R + groupW * rows.length;
  const barW = Math.min(MAX_BAR, (groupW - 30) / sections.length - BAR_GAP);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Accuracy per section for each agent"
        style={{ display: "block", minWidth: Math.min(W, 640), maxWidth: "100%" }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize={10}
              fill="var(--muted)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {(t * 100).toFixed(0)}%
            </text>
          </g>
        ))}

        {rows.map((row, gi) => {
          const gx = PAD_L + groupW * gi;
          const inner = sections.length * barW + (sections.length - 1) * BAR_GAP;
          const startX = gx + (groupW - inner) / 2;

          return (
            <g key={row.loginId}>
              {sections.map((s, si) => {
                const cell = row.cells.find((c) => c.sectionId === s.sectionId);
                const acc = cell?.accuracy ?? Number.NaN;
                const x = startX + si * (barW + BAR_GAP);
                if (Number.isNaN(acc)) return null;

                // Clamp so a sub-floor value still renders (it can't escape the plot).
                const top = y(Math.max(acc, floor));
                const frac = cell ? countLabel(cell.numerator, cell.denominator) : "";
                const href = baseQuery
                  ? `/reports/detail?${baseQuery}&focus=agent&loginId=${row.loginId}`
                  : undefined;

                const mark = (
                  <>
                    <title>
                      {`${row.agentName}\n${s.code} — ${s.label}: ${pct(acc)}` +
                        (frac ? ` (${frac})` : "")}
                    </title>
                    <rect
                      x={x}
                      y={top}
                      width={barW}
                      height={Math.max(1, y(floor) - top)}
                      rx={4}
                      fill={seriesColor(si)}
                    />
                    <text
                      x={x + barW / 2}
                      y={top - 5}
                      textAnchor="middle"
                      fontSize={LABEL_SIZE}
                      fontWeight={600}
                      fill="var(--foreground)"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {label(acc)}
                    </text>
                  </>
                );

                return href ? (
                  <a key={s.sectionId} href={href} style={{ cursor: "pointer" }}>
                    {mark}
                  </a>
                ) : (
                  <g key={s.sectionId}>{mark}</g>
                );
              })}

              <text
                x={gx + groupW / 2}
                y={PAD_T + PLOT_H + 16}
                textAnchor="middle"
                fontSize={10.5}
                fill="var(--foreground)"
              >
                {row.agentName.length > Math.floor(groupW / 6)
                  ? `${row.agentName.slice(0, Math.floor(groupW / 6) - 1)}…`
                  : row.agentName}
              </text>
            </g>
          );
        })}

        {/* Legend — always present for 2+ series, so identity is never colour-alone. */}
        {sections.map((s, i) => {
          const itemW = Math.min(150, (W - PAD_L) / sections.length);
          const lx = PAD_L + itemW * i;
          const ly = H - 16;
          return (
            <g key={s.sectionId}>
              <rect x={lx} y={ly - 8} width={9} height={9} rx={2} fill={seriesColor(i)} />
              <text x={lx + 14} y={ly} fontSize={10} fill="var(--muted)">
                {s.code} — {s.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
