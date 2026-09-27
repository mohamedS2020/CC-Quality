import { isWideFormat } from "@/lib/import/sheet";
import { parseWide, parseWideDate } from "@/lib/import/wide";

const CODES = ["CC", "EUC", "BC", "NC"];

describe("isWideFormat", () => {
  it("detects a wide header (section columns, no error_reason)", () => {
    expect(isWideFormat(["AGENT NAME", "Login ID", "Call Date", "CC", "EC", "NC"], CODES)).toBe(
      true,
    );
  });
  it("treats an explicit error_reason header as long", () => {
    expect(isWideFormat(["eval_id", "login_id", "section_code", "error_reason"], CODES)).toBe(
      false,
    );
  });
  it("is long when there are no section columns", () => {
    expect(isWideFormat(["eval_id", "login_id", "call_date"], CODES)).toBe(false);
  });
});

describe("parseWideDate", () => {
  it("normalizes the source date forms to YYYY-MM-DD", () => {
    expect(parseWideDate("Tue Jul 01 2025 03:00:00 GMT+0300")).toBe("2025-07-01");
    expect(parseWideDate("2025-07-04T00:00:00.000Z")).toBe("2025-07-04");
  });
});

describe("parseWide", () => {
  const sheet = {
    header: [
      "AGENT NAME",
      "TEAM LEADER",
      "Call Date",
      "Mobile Number",
      "Login ID (Required)",
      "Call Type",
      "QA Owner",
      "CC",
      "EC",
      "NC",
    ],
    rows: [
      // A call with an EC (→EUC) flag and an NC flag.
      [
        "Ann",
        "Lead",
        "Tue Jul 01 2025",
        "1007005658",
        "120",
        "Facility Request",
        "qa",
        "",
        "Not friendly Behavior",
        "Incomplete closing",
      ],
      // A clean call (no section cells).
      ["Bo", "Lead", "2025-07-02", "1112223333", "121", "General inquiry", "qa", "", "", ""],
    ],
  };

  it("classifies columns and pivots each row into meta + section flags", () => {
    const calls = parseWide(sheet, CODES);
    expect(calls).toHaveLength(2);

    const [a, b] = calls;
    expect(a.meta).toMatchObject({
      agent_name: "Ann",
      login_id: "120",
      call_date: "2025-07-01",
      mobile: "1007005658",
      call_type: "Facility Request",
      qa_owner: "qa",
    });
    // TEAM LEADER is ignored (not a known meta field).
    expect(a.meta.team_leader).toBeUndefined();
    // EC → EUC, and the NC cell both become flags.
    expect(a.flags).toEqual([
      { sectionCode: "EUC", source: "Not friendly Behavior" },
      { sectionCode: "NC", source: "Incomplete closing" },
    ]);
    expect(b.flags).toEqual([]);
  });
});
