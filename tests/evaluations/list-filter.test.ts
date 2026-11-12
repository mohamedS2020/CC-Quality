import {
  agentOptions,
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
  phone = "******1234",
) => ({
  agentLoginId,
  agentName,
  tlName,
  failed,
  phoneMasked: phone,
});

const rows = [
  row(1, "Zed", "TL A", false),
  row(1, "Zed", "TL A", true, "******9999"),
  row(2, "Amy", "TL A", false),
  row(3, "Bob", "TL B", true),
  row(3, "Bob", "TL B", false),
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
    const p = filtersToParams({ agent: "3", tl: "TL B", result: "fail" });
    expect(p.toString()).toBe("tl=TL+B&agent=3&result=fail");
    expect(filtersFromParams(p)).toEqual({ agent: "3", tl: "TL B", result: "fail" });
    expect(filtersFromParams(new URLSearchParams("result=maybe"))).toEqual({
      agent: "",
      tl: "",
      result: "",
    });
  });
});
