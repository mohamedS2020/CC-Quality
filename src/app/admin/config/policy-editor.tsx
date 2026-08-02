"use client";

import type { ConfigInput } from "@/lib/config/input";

const hint: React.CSSProperties = { color: "var(--muted)", fontSize: "0.82rem" };

export type PolicyFields = Pick<
  ConfigInput,
  "roundingDecimals" | "paretoCutoff" | "newAgentTenureDays" | "trialWindowDays"
>;

/**
 * The version's system-wide policy scalars (Appendix H + FR-13). These are
 * config data, not engine constants — editing them creates a new version.
 */
export function PolicyEditor({
  policy,
  onChange,
}: {
  policy: PolicyFields;
  onChange: (patch: Partial<PolicyFields>) => void;
}) {
  const num = (v: string) => (v === "" ? undefined : Number(v));

  return (
    <div style={{ display: "grid", gap: "1.25rem", maxWidth: 480 }}>
      <p className="muted" style={{ margin: 0 }}>
        System-wide policy for this version. Past periods keep the version they were scored under,
        so changing a value here only affects new scoring and current derivations.
      </p>

      <label className="field">
        <span>Published decimal places</span>
        <input
          className="input"
          type="number"
          min={0}
          step={1}
          aria-label="roundingDecimals"
          value={policy.roundingDecimals ?? ""}
          onChange={(e) => onChange({ roundingDecimals: num(e.target.value) })}
          style={{ width: 160 }}
        />
        <span style={hint}>Precision of published percentages (Appendix H).</span>
      </label>

      <label className="field">
        <span>Pareto cutoff</span>
        <input
          className="input"
          type="number"
          min={0}
          max={1}
          step={0.05}
          aria-label="paretoCutoff"
          value={policy.paretoCutoff ?? ""}
          onChange={(e) => onChange({ paretoCutoff: num(e.target.value) })}
          style={{ width: 160 }}
        />
        <span style={hint}>
          Share of impact the “vital few” errors must cover, 0–1 (Appendix H).
        </span>
      </label>

      <label className="field">
        <span>New-agent tenure threshold (days)</span>
        <input
          className="input"
          type="number"
          min={0}
          step={1}
          aria-label="newAgentTenureDays"
          value={policy.newAgentTenureDays ?? ""}
          onChange={(e) => onChange({ newAgentTenureDays: num(e.target.value) })}
          style={{ width: 160 }}
        />
        <span style={hint}>
          Tenure below this counts an agent as “new”, otherwise “old” (FR-13).
        </span>
      </label>

      <label className="field">
        <span>Trial / probation window (days)</span>
        <input
          className="input"
          type="number"
          min={0}
          step={1}
          aria-label="trialWindowDays"
          value={policy.trialWindowDays ?? ""}
          onChange={(e) => onChange({ trialWindowDays: num(e.target.value) })}
          style={{ width: 160 }}
        />
        <span style={hint}>
          Within this many days of the join date, an agent is in trial (FR-13).
        </span>
      </label>
    </div>
  );
}
