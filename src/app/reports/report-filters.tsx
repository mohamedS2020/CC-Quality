"use client";

import { useRouter } from "next/navigation";

export interface FilterOptions {
  periods: { id: number; label: string }[];
  teamLeads: string[];
  agents: { loginId: number; agentName: string }[];
  lenses: { key: string; label: string; provisional: boolean }[];
}

export interface FilterValues {
  scope: "account" | "tl" | "agent";
  tl: string | null;
  agentLoginId: number | null;
  period: string;
  lens: string;
}

const field: React.CSSProperties = { display: "grid", gap: "0.25rem", minWidth: 150 };

export function ReportFilters({
  options,
  values,
  lockScope = false,
}: {
  options: FilterOptions;
  values: FilterValues;
  /** Agents can only ever see their own data (FR-38) — hide the scope controls. */
  lockScope?: boolean;
}) {
  const router = useRouter();

  function navigate(patch: Partial<Record<"scope" | "period" | "lens" | "tl" | "agent", string>>) {
    const merged = {
      scope: values.scope,
      period: values.period,
      lens: values.lens,
      tl: values.tl ?? "",
      agent: values.agentLoginId != null ? String(values.agentLoginId) : "",
      ...patch,
    };
    const params = new URLSearchParams();
    params.set("scope", merged.scope);
    if (merged.period) params.set("period", merged.period);
    if (merged.lens) params.set("lens", merged.lens);
    if (merged.scope === "tl" && merged.tl) params.set("tl", merged.tl);
    if (merged.scope === "agent" && merged.agent) params.set("agent", merged.agent);
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <div
      className="card"
      style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", alignItems: "flex-end" }}
    >
      {!lockScope && (
        <label style={field}>
          <span className="label">Scope</span>
          <select
            className="select"
            aria-label="scope"
            value={values.scope}
            onChange={(e) => navigate({ scope: e.target.value })}
          >
            <option value="account">Whole account</option>
            <option value="tl">By team leader</option>
            <option value="agent">By agent</option>
          </select>
        </label>
      )}

      {!lockScope && values.scope === "tl" && (
        <label style={field}>
          <span className="label">Team leader</span>
          <select
            className="select"
            aria-label="tl"
            value={values.tl ?? ""}
            onChange={(e) => navigate({ tl: e.target.value })}
          >
            <option value="">— all —</option>
            {options.teamLeads.map((tl) => (
              <option key={tl} value={tl}>
                {tl}
              </option>
            ))}
          </select>
        </label>
      )}

      {!lockScope && values.scope === "agent" && (
        <label style={field}>
          <span className="label">Agent</span>
          <select
            className="select"
            aria-label="agent"
            value={values.agentLoginId != null ? String(values.agentLoginId) : ""}
            onChange={(e) => navigate({ agent: e.target.value })}
          >
            <option value="">— select —</option>
            {options.agents.map((a) => (
              <option key={a.loginId} value={a.loginId}>
                {a.agentName} ({a.loginId})
              </option>
            ))}
          </select>
        </label>
      )}

      <label style={field}>
        <span className="label">Period</span>
        <select
          className="select"
          aria-label="period"
          value={values.period}
          onChange={(e) => navigate({ period: e.target.value })}
        >
          {options.periods.map((p) => (
            <option key={p.id} value={p.label}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label style={field}>
        <span className="label">Lens</span>
        <select
          className="select"
          aria-label="lens"
          value={values.lens}
          onChange={(e) => navigate({ lens: e.target.value })}
        >
          {options.lenses.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
              {l.provisional ? " (provisional)" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
