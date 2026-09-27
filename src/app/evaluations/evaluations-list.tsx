"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { displayMobile, phoneSearchDigits } from "@/lib/pii";
import { Pager, PAGE_SIZE } from "../_components/pager";

/**
 * Evaluations list with an instant phone-number filter for admins/moderators
 * (`canSearch`). The phone is stored masked (last 4 digits), so the filter
 * matches by suffix and never puts a number in the URL (FR-19) — it runs
 * client-side over the already-loaded, already-masked rows.
 */

export interface EvalRow {
  evalId: string;
  callDate: string;
  agentName: string;
  qaOwner: string;
  status: string;
  failed: boolean;
  configVersion: number;
  corrected: boolean;
  phoneMasked: string | null;
}

export function EvaluationsList({ rows, canSearch }: { rows: EvalRow[]; canSearch: boolean }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const last4 = canSearch ? phoneSearchDigits(query) : "";
  const filtered = useMemo(
    () => (last4 ? rows.filter((r) => (r.phoneMasked ?? "").endsWith(last4)) : rows),
    [rows, last4],
  );
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const clampedPage = Math.min(page, Math.max(0, pageCount - 1));
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      {canSearch && (
        <div
          className="card"
          style={{
            marginTop: "1.5rem",
            padding: "0.6rem 0.75rem",
            display: "flex",
            gap: "0.6rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label htmlFor="phone-search" style={{ fontSize: "0.9rem", fontWeight: 500 }}>
            Search by phone number
          </label>
          <input
            id="phone-search"
            className="input"
            inputMode="numeric"
            placeholder="Full number or last 4 digits"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            style={{ maxWidth: 260 }}
          />
          {query && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setQuery("");
                setPage(0);
              }}
            >
              Clear
            </button>
          )}
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            {last4
              ? `${filtered.length} match${filtered.length === 1 ? "" : "es"}`
              : `${rows.length} calls`}
          </span>
        </div>
      )}

      <div
        className="card"
        style={{ marginTop: canSearch ? "0.75rem" : "1.5rem", padding: "0.5rem 0.75rem" }}
      >
        {filtered.length === 0 ? (
          <p className="empty" style={{ border: "none" }}>
            {last4 ? "No calls match that phone number." : "No evaluations yet."}
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
                    <Link href={`/evaluations/${e.evalId}`}>View →</Link>
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
