"use client";

import { useState } from "react";
import Link from "next/link";
import { Pager, PAGE_SIZE } from "../../_components/pager";

export interface AgentRow {
  loginId: number;
  agentName: string;
  tlName: string;
  joinDate: string;
  status: string | null;
  tenureDays: number | null;
  inTrial: boolean;
  active: boolean;
}

export function AgentsList({ rows }: { rows: AgentRow[] }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  const clampedPage = Math.min(page, Math.max(0, pageCount - 1));
  const pageRows = rows.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="card" style={{ marginTop: "1.5rem", padding: "0.5rem 0.75rem" }}>
      {rows.length === 0 ? (
        <p className="empty" style={{ border: "none" }}>
          No agents yet.
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Login ID</th>
              <th>Agent</th>
              <th>Team leader</th>
              <th>Join date</th>
              <th>Tenure</th>
              <th>Trial</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((a) => (
              <tr key={a.loginId}>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{a.loginId}</td>
                <td>{a.agentName}</td>
                <td className="muted">{a.tlName}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{a.joinDate}</td>
                <td>
                  {a.status ? (
                    <>
                      {a.status} <span className="muted">({a.tenureDays}d)</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {a.inTrial ? (
                    <span className="badge badge-warning">In trial</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {a.active ? (
                    <span className="badge badge-success">Active</span>
                  ) : (
                    <span className="badge">Inactive</span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link href={`/admin/agents/${a.loginId}`}>Edit →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager page={clampedPage} pageCount={pageCount} onPage={setPage} />
    </div>
  );
}
