/**
 * Evaluations list filters in the UI: agent / team leader / result / phone
 * combine, the team picks narrow the agent list, the URL carries everything but
 * the phone number, and agents only get the Result filter.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EvaluationsList, type EvalRow } from "@/app/evaluations/evaluations-list";

let mockSearch = "";
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

const base = { qaOwner: "QA", configVersion: 1, corrected: false };
const mk = (
  id: string,
  agentLoginId: number,
  agentName: string,
  tlName: string,
  failed: boolean,
  phoneMasked = "******1234",
): EvalRow => ({
  ...base,
  evalId: id,
  callDate: "2026-01-01",
  agentLoginId,
  agentName,
  tlName,
  failed,
  status: failed ? "Fail" : "Pass",
  phoneMasked,
});

const rows: EvalRow[] = [
  mk("e1", 1, "Zed Agent", "TL A", false),
  mk("e2", 1, "Zed Agent", "TL A", true, "******9999"),
  mk("e3", 2, "Amy Agent", "TL A", false),
  mk("e4", 3, "Bob Agent", "TL B", true),
];

const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

beforeEach(() => {
  mockSearch = "";
  window.history.replaceState(null, "", "/evaluations");
});

describe("EvaluationsList filters", () => {
  it("combines team leader, agent, result and phone, and shows the count", async () => {
    const user = userEvent.setup();
    render(<EvaluationsList rows={rows} canSearch />);
    expect(screen.getByTestId("eval-count")).toHaveTextContent("4 calls");

    await user.selectOptions(screen.getByLabelText("filter-tl"), "TL A");
    expect(bodyRows()).toHaveLength(3);
    // The agent list is narrowed to the team.
    const agentOpts = within(screen.getByLabelText("filter-agent"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(agentOpts).toEqual(["All agents", "Amy Agent (2)", "Zed Agent (1)"]);

    await user.selectOptions(screen.getByLabelText("filter-agent"), "1");
    await user.selectOptions(screen.getByLabelText("filter-result"), "fail");
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByTestId("eval-count")).toHaveTextContent("1 of 4 calls");
    expect(window.location.search).toBe("?tl=TL+A&agent=1&result=fail");

    await user.type(screen.getByLabelText("phone-search"), "1234");
    expect(screen.getByText("No calls match these filters.")).toBeInTheDocument();
    expect(window.location.search).not.toContain("1234"); // the phone never goes in the URL

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(bodyRows()).toHaveLength(4);
    expect(window.location.search).toBe("");
  });

  it("drops a chosen agent who isn't on the newly picked team", async () => {
    const user = userEvent.setup();
    render(<EvaluationsList rows={rows} canSearch />);
    await user.selectOptions(screen.getByLabelText("filter-agent"), "1");
    await user.selectOptions(screen.getByLabelText("filter-tl"), "TL B");
    expect(screen.getByLabelText("filter-agent")).toHaveValue("");
    expect(bodyRows()).toHaveLength(1);
  });

  it("starts from the filters in the URL (e.g. Back from a call)", () => {
    mockSearch = "agent=3&result=fail";
    render(<EvaluationsList rows={rows} canSearch />);
    expect(screen.getByLabelText("filter-agent")).toHaveValue("3");
    expect(bodyRows()).toHaveLength(1);
  });

  it("gives agents only the Result filter", async () => {
    const user = userEvent.setup();
    mockSearch = "agent=3";
    render(<EvaluationsList rows={rows} canSearch={false} />);
    expect(screen.queryByLabelText("filter-agent")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("filter-tl")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("phone-search")).not.toBeInTheDocument();
    expect(bodyRows()).toHaveLength(4); // a URL agent filter is ignored for agents
    await user.selectOptions(screen.getByLabelText("filter-result"), "pass");
    expect(bodyRows()).toHaveLength(2);
  });
});
