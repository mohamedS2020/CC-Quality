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
  phoneLast4: string; // "" = no phone search
}

export interface FilterableRow {
  agentLoginId: number;
  agentName: string;
  tlName: string;
  failed: boolean;
  phoneMasked: string | null;
}

export const NO_FILTERS: ListFilters = { agent: "", tl: "", result: "", phoneLast4: "" };

export function filterRows<T extends FilterableRow>(rows: T[], f: ListFilters): T[] {
  return rows.filter(
    (r) =>
      (!f.agent || String(r.agentLoginId) === f.agent) &&
      (!f.tl || r.tlName === f.tl) &&
      (!f.result || r.failed === (f.result === "fail")) &&
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
  return {
    agent: params.get("agent") ?? "",
    tl: params.get("tl") ?? "",
    result: result === "pass" || result === "fail" ? result : "",
  };
}

export function filtersToParams(f: Omit<ListFilters, "phoneLast4">): URLSearchParams {
  const p = new URLSearchParams();
  if (f.tl) p.set("tl", f.tl);
  if (f.agent) p.set("agent", f.agent);
  if (f.result) p.set("result", f.result);
  return p;
}
