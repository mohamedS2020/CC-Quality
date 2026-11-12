import {
  agentOptions,
  dateRangeReversed,
  filterRows,
  filtersFromParams,
  filtersToParams,
  NO_FILTERS,
  teamLeadOptions,
} from "@/lib/evaluations/list-filter";

const row = (
  agentLoginId: number,
  agentName: string,
  tlName: string,
  failed: boolean,
  callDate: string,
  phone = "******1234",
) => ({ agentLoginId, agentName, tlName, failed, callDate, phoneMasked: phone });

const rows = [
  row(1, "Zed", "TL A", false, "2026-01-05"),
  row(1, "Zed", "TL A", true, "2026-01-31", "******9999"),
  row(2, "Amy", "TL A", false, "2026-02-01"),
  row(3, "Bob", "TL B", true, "2026-02-15"),
  row(3, "Bob", "TL B", false, "2026-03-01"),
];

describe("evaluations list filters", () => {
  it("returns everything with no filters", () => {
    expect(filterRows(rows, NO_FILTERS)).toHaveLength(5);
  });

  it("filters by agent, team leader and result, and combines them", () => {
    expect(filterRows(rows, { ...NO_FILTERS, agent: "1" })).toHaveLength(2);
    expect(filterRows(rows, { ...NO_FILTERS, tl: "TL B" })).toHaveLength(2);
    expect(filterRows(rows, { ...NO_FILTERS, result: "fail" })).toHaveLength(2);
    expect(filterRows(rows, { ...NO_FILTERS, result: "pass" })).toHaveLength(3);
    expect(filterRows(rows, { ...NO_FILTERS, tl: "TL A", result: "fail" })).toEqual([rows[1]]);
    expect(filterRows(rows, { ...NO_FILTERS, agent: "1", phoneLast4: "9999" })).toEqual([rows[1]]);
    expect(filterRows(rows, { ...NO_FILTERS, agent: "2", tl: "TL B" })).toEqual([]);
  });

  it("filters by call date, inclusive at both ends, alone or with other filters", () => {
    expect(filterRows(rows, { ...NO_FILTERS, from: "2026-01-31" })).toHaveLength(4);
    expect(filterRows(rows, { ...NO_FILTERS, to: "2026-01-31" })).toHaveLength(2);
    expect(filterRows(rows, { ...NO_FILTERS, from: "2026-01-31", to: "2026-02-15" })).toHaveLength(
      3,
    );
    expect(filterRows(rows, { ...NO_FILTERS, from: "2026-02-01", to: "2026-02-01" })).toEqual([
      rows[2],
    ]);
    expect(
      filterRows(rows, { ...NO_FILTERS, from: "2026-02-01", to: "2026-03-31", result: "fail" }),
    ).toEqual([rows[3]]);
  });

  it("ignores a reversed date range instead of hiding everything", () => {
    const f = { ...NO_FILTERS, from: "2026-03-01", to: "2026-01-01" };
    expect(dateRangeReversed(f)).toBe(true);
    expect(filterRows(rows, f)).toHaveLength(5);
  });

  it("lists team leaders and narrows agents to the chosen team, A to Z", () => {
    expect(teamLeadOptions(rows)).toEqual(["TL A", "TL B"]);
    expect(agentOptions(rows, "")).toEqual([
      { loginId: 2, agentName: "Amy" },
      { loginId: 3, agentName: "Bob" },
      { loginId: 1, agentName: "Zed" },
    ]);
    expect(agentOptions(rows, "TL B")).toEqual([{ loginId: 3, agentName: "Bob" }]);
  });

  it("round-trips agent / team / result through the URL, ignoring junk", () => {
    const f = {
      agent: "3",
      tl: "TL B",
      result: "fail" as const,
      from: "2026-01-01",
      to: "2026-01-31",
    };
    const p = filtersToParams(f);
    expect(p.toString()).toBe("tl=TL+B&agent=3&result=fail&from=2026-01-01&to=2026-01-31");
    expect(filtersFromParams(p)).toEqual(f);
    expect(
      filtersFromParams(new URLSearchParams("result=maybe&from=yesterday&to=2026-1-5")),
    ).toEqual({
      agent: "",
      tl: "",
      result: "",
      from: "",
      to: "",
    });
  });
});
