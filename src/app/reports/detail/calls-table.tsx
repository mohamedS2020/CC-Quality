"use client";

import { useState } from "react";
import type { CallDetailRow } from "@/lib/reports/detail";
import { Pager, PAGE_SIZE } from "../../_components/pager";

/** The raw per-call table behind the report — every in-scope call, scored (paged). */
function pct(v: number, decimals: number): string {
  return Number.isNaN(v) ? "n/a" : `${(v * 100).toFixed(decimals)}%`;
}

export function CallsTable({
  rows,
  sections,
  decimals,
  highlightSectionId,
}: {
  rows: CallDetailRow[];
  sections: { sectionId: number; code: string }[];
  decimals: number;
  highlightSectionId?: number;
}) {
  const [page, setPage] = useState(0);
  if (rows.length === 0) return <p className="empty">No calls in scope.</p>;
  const hl = (id: number): React.CSSProperties =>
    id === highlightSectionId ? { background: "var(--surface-2)" } : {};

  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  const clampedPage = Math.min(page, Math.max(0, pageCount - 1));
  const pageRows = rows.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Call date</th>
              <th>Agent</th>
              <th>Call type</th>
              {sections.map((s) => (
                <th key={s.sectionId} style={{ textAlign: "center", ...hl(s.sectionId) }}>
                  {s.code}
                </th>
              ))}
              <th>Result</th>
              <th>Flagged reasons</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.evalId}>
                <td style={{ whiteSpace: "nowrap" }}>{r.callDate.toISOString().slice(0, 10)}</td>
                <td style={{ whiteSpace: "nowrap" }}>{r.agentName}</td>
                <td>{r.callType ?? "—"}</td>
                {r.sections.map((sc) => (
                  <td
                    key={sc.sectionId}
                    style={{
                      textAlign: "center",
                      fontVariantNumeric: "tabular-nums",
                      ...hl(sc.sectionId),
                    }}
                  >
                    {pct(sc.accuracy, decimals)}
                  </td>
                ))}
                <td>
                  <span
                    className={r.failedScorecard ? "badge badge-danger" : "badge badge-success"}
                  >
                    {r.failedScorecard ? "Fail" : "Pass"}
                  </span>
                </td>
                <td style={{ fontSize: "0.85rem" }}>
                  {r.flags.length === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                      {r.flags.map((f, i) => (
                        <li key={i}>
                          <strong>{f.sectionCode}</strong> · {f.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={clampedPage} pageCount={pageCount} onPage={setPage} />
    </>
  );
}
