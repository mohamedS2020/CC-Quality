/**
 * Filters for the Evaluations list (pure, so the list and its tests share it).
 * Rows are already loaded and scoped server-side; filtering them in the browser
 * keeps every change instant and costs the server nothing.
 */

export type ResultFilter = "" | "pass" | "fail";

export interface ListFilters {
  agent: string; // agent login id, "" = all
  tl: string; // team leader name, "" = all
  result: ResultFilter;
  from: string; // call date YYYY-MM-DD, inclusive; "" = open
  to: string; // call date YYYY-MM-DD, inclusive; "" = open
  phoneLast4: string; // "" = no phone search
}

export interface FilterableRow {
  callDate: string; // YYYY-MM-DD
  agentLoginId: number;
  agentName: string;
  tlName: string;
  failed: boolean;
  phoneMasked: string | null;
}

export const NO_FILTERS: ListFilters = {
  agent: "",
  tl: "",
  result: "",
  from: "",
  to: "",
  phoneLast4: "",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A From after To can't match anything — the UI warns, and the dates are ignored. */
export function dateRangeReversed(f: Pick<ListFilters, "from" | "to">): boolean {
  return !!f.from && !!f.to && f.from > f.to;
}

export function filterRows<T extends FilterableRow>(rows: T[], f: ListFilters): T[] {
  // YYYY-MM-DD compares chronologically as a plain string.
  const useDates = !dateRangeReversed(f);
  return rows.filter(
    (r) =>
      (!f.agent || String(r.agentLoginId) === f.agent) &&
      (!f.tl || r.tlName === f.tl) &&
      (!f.result || r.failed === (f.result === "fail")) &&
      (!useDates || !f.from || r.callDate >= f.from) &&
      (!useDates || !f.to || r.callDate <= f.to) &&
      (!f.phoneLast4 || (r.phoneMasked ?? "").endsWith(f.phoneLast4)),
  );
}

/** Team leaders present in the rows, A→Z. */
export function teamLeadOptions(rows: FilterableRow[]): string[] {
  return [...new Set(rows.map((r) => r.tlName))].sort((a, b) => a.localeCompare(b));
}

/** Agents present in the rows (only the chosen team's, when one is picked), A→Z. */
export function agentOptions(
  rows: FilterableRow[],
  tl: string,
): { loginId: number; agentName: string }[] {
  const byId = new Map<number, string>();
  for (const r of rows) if (!tl || r.tlName === tl) byId.set(r.agentLoginId, r.agentName);
  return [...byId]
    .map(([loginId, agentName]) => ({ loginId, agentName }))
    .sort((a, b) => a.agentName.localeCompare(b.agentName));
}

/** Read the URL-safe filters (never the phone number, FR-19) from a query string. */
export function filtersFromParams(params: URLSearchParams): Omit<ListFilters, "phoneLast4"> {
  const result = params.get("result");
  const date = (key: string) => {
    const v = params.get(key) ?? "";
    return ISO_DATE.test(v) ? v : "";
  };
  return {
    agent: params.get("agent") ?? "",
    tl: params.get("tl") ?? "",
    result: result === "pass" || result === "fail" ? result : "",
    from: date("from"),
    to: date("to"),
  };
}

export function filtersToParams(f: Omit<ListFilters, "phoneLast4">): URLSearchParams {
  const p = new URLSearchParams();
  if (f.tl) p.set("tl", f.tl);
  if (f.agent) p.set("agent", f.agent);
  if (f.result) p.set("result", f.result);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  return p;
}
