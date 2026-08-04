import type { SectionMetric } from "@/lib/reports/metrics";

/**
 * Chart #1 — section accuracy vs benchmark (Appendix F). A column per section on
 * a FIXED 0–100% axis, coloured by pass/fail status (the number is always shown,
 * so identity never rests on colour alone), with a dashed benchmark reference
 * line per section. `≥ benchmark` passes.
 */

const W = 720;
const H = 300;
const padL = 42;
const padR = 16;
const padT = 22;
const padB = 44;
const plotH = H - padT - padB;
const plotW = W - padL - padR;
const y = (v: number) => padT + plotH * (1 - v); // v in [0,1] → pixel

function statusColor(s: SectionMetric["status"]): string {
  if (s === "pass") return "var(--success)";
  if (s === "fail") return "var(--danger)";
  return "var(--faint)";
}

export function SectionBenchmarkChart({
  sections,
  decimals,
}: {
  sections: SectionMetric[];
  decimals: number;
}) {
  const pct = (v: number | undefined) =>
    v == null || Number.isNaN(v) ? "n/a" : `${(v * 100).toFixed(decimals)}%`;
  const bandW = plotW / Math.max(1, sections.length);
  const barW = Math.min(70, bandW * 0.52);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Section accuracy versus benchmark"
      style={{ display: "block", maxWidth: "100%" }}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
            {t * 100}%
          </text>
        </g>
      ))}

      {sections.map((s, i) => {
        const cx = padL + bandW * i + bandW / 2;
        const barX = cx - barW / 2;
        const acc = Number.isNaN(s.accuracy) ? 0 : s.accuracy;
        const top = y(acc);
        return (
          <g key={s.sectionId}>
            <title>
              {`${s.code} — ${s.label}\nAccuracy ${pct(s.accuracy)}` +
                (s.benchmark != null ? ` · benchmark ${pct(s.benchmark)} · ${s.status}` : "")}
            </title>
            {!Number.isNaN(s.accuracy) && (
              <rect
                x={barX}
                y={top}
                width={barW}
                height={Math.max(0, y(0) - top)}
                rx={4}
                fill={statusColor(s.status)}
              />
            )}
            {s.benchmark != null && (
              <line
                x1={cx - barW / 2 - 7}
                x2={cx + barW / 2 + 7}
                y1={y(s.benchmark)}
                y2={y(s.benchmark)}
                stroke="var(--foreground)"
                strokeWidth={2}
                strokeDasharray="3 3"
              />
            )}
            <text
              x={cx}
              y={top - 6}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="var(--foreground)"
            >
              {pct(s.accuracy)}
            </text>
            <text
              x={cx}
              y={H - padB + 18}
              textAnchor="middle"
              fontSize={12}
              fill="var(--foreground)"
            >
              {s.code}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
