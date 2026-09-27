"use client";

import { useState } from "react";
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
  /** The applied custom range (both set), or null when reporting on a period. */
  from: string | null;
  to: string | null;
}

const field: React.CSSProperties = { display: "grid", gap: "0.25rem", minWidth: 150 };

/** `YYYY-MM-DD` sorts lexicographically, so plain string compare is chronological. */
const todayISO = () => new Date().toISOString().slice(0, 10);

export function ReportFilters({
  options,
  values,
  lockScope = false,
  lockLens = false,
}: {
  options: FilterOptions;
  values: FilterValues;
  /** Agents can only ever see their own data (FR-38) — hide the scope controls. */
  lockScope?: boolean;
  /** Agents are pinned to the Agent lens — hide the lens control. */
  lockLens?: boolean;
}) {
  const router = useRouter();
  const applied = !!(values.from && values.to);
  const [mode, setMode] = useState<"period" | "range">(applied ? "range" : "period");
  // Draft range: typing shouldn't re-run the report, so it's applied explicitly.
  const [from, setFrom] = useState(values.from ?? "");
  const [to, setTo] = useState(values.to ?? "");

  function navigate(
    patch: Partial<Record<"scope" | "period" | "lens" | "tl" | "agent" | "from" | "to", string>>,
  ) {
    const merged = {
      scope: values.scope,
      period: values.period,
      lens: values.lens,
      tl: values.tl ?? "",
      agent: values.agentLoginId != null ? String(values.agentLoginId) : "",
      from: values.from ?? "",
      to: values.to ?? "",
      ...patch,
    };
    const params = new URLSearchParams();
    params.set("scope", merged.scope);
    // A custom range replaces the period — keep exactly one in the URL.
    if (merged.from && merged.to) {
      params.set("from", merged.from);
      params.set("to", merged.to);
    } else if (merged.period) {
      params.set("period", merged.period);
    }
    if (merged.lens) params.set("lens", merged.lens);
    if (merged.scope === "tl" && merged.tl) params.set("tl", merged.tl);
    if (merged.scope === "agent" && merged.agent) params.set("agent", merged.agent);
    router.push(`/reports?${params.toString()}`);
  }

  const reversed = !!from && !!to && from > to;
  const canApply = !!from && !!to && !reversed;

  function changeMode(next: "period" | "range") {
    setMode(next);
    // Leaving a custom range drops it from the URL, falling back to the period.
    if (next === "period" && applied) navigate({ from: "", to: "" });
  }

  function clearRange() {
    setFrom("");
    setTo("");
    setMode("period");
    if (applied) navigate({ from: "", to: "" });
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
        <span className="label">Date filter</span>
        <select
          className="select"
          aria-label="date mode"
          value={mode}
          onChange={(e) => changeMode(e.target.value === "range" ? "range" : "period")}
        >
          <option value="period">Month</option>
          <option value="range">Custom range</option>
        </select>
      </label>

      {mode === "period" ? (
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
      ) : (
        <>
          <label style={field}>
            <span className="label">From</span>
            <input
              className="input"
              type="date"
              aria-label="from"
              max={to || todayISO()}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label style={field}>
            <span className="label">To</span>
            <input
              className="input"
              type="date"
              aria-label="to"
              min={from || undefined}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!canApply}
              onClick={() => navigate({ from, to })}
            >
              Apply
            </button>
            {(applied || from || to) && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearRange}>
                Clear
              </button>
            )}
          </div>
          {reversed && (
            <span className="badge badge-warning">“From” must be on or before “To”.</span>
          )}
        </>
      )}

      {!lockLens && (
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
      )}
    </div>
  );
}
