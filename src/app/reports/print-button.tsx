"use client";

/** "Export PDF" via the browser's print-to-PDF (dependency-free). */
export function PrintButton() {
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
      Export PDF
    </button>
  );
}
