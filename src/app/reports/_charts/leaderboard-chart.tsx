import type { LeaderboardRow } from "@/lib/reports/metrics";

/**
 * Chart #5 — agent leaderboard, rank descending. Horizontal rank bars with tier
 * colours; the rank number is always shown, so the tier colour is a secondary
 * encoding. Tiers are fixed bands for now (a config-driven "levels" set is a
 * later refinement, per the golden rule).
 */

interface Tier {
  min: number;
  label: string;
  color: string;
}
const TIERS: Tier[] = [
  { min: 90, label: "Excellent", color: "var(--success)" },
  { min: 75, label: "Strong", color: "var(--accent)" },
  { min: 50, label: "Developing", color: "var(--warning)" },
  { min: 0, label: "Needs focus", color: "var(--danger)" },
];
const tierOf = (rank: number): Tier => TIERS.find((t) => rank >= t.min) ?? TIERS[TIERS.length - 1];

export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) return <p className="muted">No agents in scope.</p>;

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      {rows.map((r, i) => {
        const tier = tierOf(r.rank);
        return (
          <div
            key={r.loginId}
            style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.9rem" }}
          >
            <span
              style={{
                width: "1.4rem",
                textAlign: "right",
                color: "var(--muted)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {i + 1}
            </span>
            <span
              style={{
                width: "9rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {r.agentName}
            </span>
            <div
              style={{
                flex: 1,
                height: 20,
                borderRadius: 6,
                background: "var(--surface-2)",
                overflow: "hidden",
              }}
              title={`Rank ${r.rank} — ${tier.label}`}
            >
              <div
                style={{
                  width: `${r.rank}%`,
                  height: "100%",
                  background: tier.color,
                  borderRadius: 6,
                }}
              />
            </div>
            <span
              style={{
                width: "2.4rem",
                textAlign: "right",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {r.rank}
            </span>
            <span
              className="badge"
              style={{
                background: "transparent",
                color: tier.color,
                border: `1px solid ${tier.color}`,
                minWidth: "6.5rem",
                justifyContent: "center",
              }}
            >
              {tier.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
