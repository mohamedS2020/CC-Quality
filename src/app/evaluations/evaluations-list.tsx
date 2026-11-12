"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { displayMobile, phoneSearchDigits } from "@/lib/pii";
import {
  agentOptions,
  filterRows,
  filtersFromParams,
  filtersToParams,
  teamLeadOptions,
  type ResultFilter,
} from "@/lib/evaluations/list-filter";
import { Pager, PAGE_SIZE } from "../_components/pager";

/**
 * Evaluations list with instant filters over the already-loaded, already-scoped
 * rows: Result (Pass/Fail) for everyone, plus agent, team leader and phone
 * number for admins/moderators (`canSearch`). Agent / team leader / result live
 * in the URL, so Back from a call keeps them; the phone never does (FR-19) — it
 * is stored masked (last 4 digits) and matched by suffix.
 */

export interface EvalRow {
  evalId: string;
  callDate: string;
  agentLoginId: number;
  agentName: string;
  tlName: string;
  qaOwner: string;
  status: string;
  failed: boolean;
  configVersion: number;
  corrected: boolean;
  phoneMasked: string | null;
}

export function EvaluationsList({ rows, canSearch }: { rows: EvalRow[]; canSearch: boolean }) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => {
    const f = filtersFromParams(new URLSearchParams(searchParams?.toString() ?? ""));
    // Agents can't pick an agent or team (their rows are already only theirs).
    return canSearch ? f : { ...f, agent: "", tl: "" };
  });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const last4 = canSearch ? phoneSearchDigits(query) : "";
  const filtered = useMemo(
    () => filterRows(rows, { ...filters, phoneLast4: last4 }),
    [rows, filters, last4],
  );
  const tls = useMemo(() => teamLeadOptions(rows), [rows]);
  const agents = useMemo(() => agentOptions(rows, filters.tl), [rows, filters.tl]);
  const active = !!(filters.agent || filters.tl || filters.result || last4);

  function update(patch: Partial<typeof filters>) {
    const next = { ...filters, ...patch };
    // Picking a team drops an agent who isn't on it.
    if (
      patch.tl !== undefined &&
      next.agent &&
      !agentOptions(rows, next.tl).some((a) => String(a.loginId) === next.agent)
    ) {
      next.agent = "";
    }
    setFilters(next);
    setPage(0);
    // Shallow URL update (no server round trip) so Back from a call keeps the filters.
    const qs = filtersToParams(next).toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  function clearAll() {
    setQuery("");
    update({ agent: "", tl: "", result: "" });
  }
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const clampedPage = Math.min(page, Math.max(0, pageCount - 1));
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <div
        className="card"
        style={{
          marginTop: "1.5rem",
          padding: "0.6rem 0.75rem",
          display: "flex",
          gap: "0.75rem",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        {canSearch && (
          <>
            <label className="field" style={{ minWidth: 200 }}>
              <span>Team leader</span>
              <select
                className="select"
                aria-label="filter-tl"
                value={filters.tl}
                onChange={(e) => update({ tl: e.target.value })}
              >
                <option value="">All team leaders</option>
                {tls.map((tl) => (
                  <option key={tl} value={tl}>
                    {tl}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ minWidth: 220 }}>
              <span>Agent</span>
              <select
                className="select"
                aria-label="filter-agent"
                value={filters.agent}
                onChange={(e) => update({ agent: e.target.value })}
              >
                <option value="">All agents</option>
                {agents.map((a) => (
                  <option key={a.loginId} value={String(a.loginId)}>
                    {a.agentName} ({a.loginId})
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="field" style={{ minWidth: 130 }}>
          <span>Result</span>
          <select
            className="select"
            aria-label="filter-result"
            value={filters.result}
            onChange={(e) => update({ result: e.target.value as ResultFilter })}
          >
            <option value="">All</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
        </label>
        {canSearch && (
          <label className="field" style={{ minWidth: 220 }}>
            <span>Phone number</span>
            <input
              id="phone-search"
              className="input"
              aria-label="phone-search"
              inputMode="numeric"
              placeholder="Full number or last 4 digits"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </label>
        )}
        {active && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={clearAll}>
            Clear filters
          </button>
        )}
        <span
          className="muted"
          data-testid="eval-count"
          style={{ fontSize: "0.8rem", marginLeft: "auto", alignSelf: "center" }}
        >
          {active ? `${filtered.length} of ${rows.length} calls` : `${rows.length} calls`}
        </span>
      </div>

      <div className="card" style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem" }}>
        {filtered.length === 0 ? (
          <p className="empty" style={{ border: "none" }}>
            {active ? "No calls match these filters." : "No evaluations yet."}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Call date</th>
                <th>Agent</th>
                {canSearch && <th>Phone Number</th>}
                <th>QA owner</th>
                <th>Result</th>
                <th>Config</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((e) => (
                <tr key={e.evalId}>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{e.callDate}</td>
                  <td>{e.agentName}</td>
                  {canSearch && (
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {displayMobile(e.phoneMasked)}
                    </td>
                  )}
                  <td className="muted">{e.qaOwner}</td>
                  <td>
                    <span className={e.failed ? "badge badge-danger" : "badge badge-success"}>
                      {e.status}
                    </span>
                  </td>
                  <td>
                    <span title="Scorecard configuration version">v{e.configVersion}</span>
                    {e.corrected && (
                      <span className="badge badge-accent" style={{ marginLeft: "0.4rem" }}>
                        corrected
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link prefetch={false} href={`/evaluations/${e.evalId}`}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={clampedPage} pageCount={pageCount} onPage={setPage} />
      </div>
    </>
  );
}
