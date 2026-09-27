"use client";

/** Prev/next page controls (hidden when there's a single page). */
export function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
        justifyContent: "flex-end",
        marginTop: "0.75rem",
      }}
    >
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        disabled={page <= 0}
        onClick={() => onPage(page - 1)}
      >
        ‹ Prev
      </button>
      <span className="muted" style={{ fontSize: "0.85rem" }}>
        Page {page + 1} of {pageCount}
      </span>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        disabled={page >= pageCount - 1}
        onClick={() => onPage(page + 1)}
      >
        Next ›
      </button>
    </div>
  );
}

export const PAGE_SIZE = 10;
