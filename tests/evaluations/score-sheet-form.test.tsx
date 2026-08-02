/**
 * Score-sheet form → derivation boundary (task 6.9). Proves the UI collects only
 * enter-only fields + flagged reasons (never a typed figure, FR-16), tracks the
 * per-section flag count, and hands the draft to the derivation action. The
 * action→engine half is covered by create.test.ts; together they trace the whole
 * form → engine derivation path.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoreSheetForm } from "@/app/evaluations/new/score-sheet-form";
import { createEvaluationAction } from "@/app/evaluations/new/actions";
import type { ScoreSheetAgent, ScoreSheetRubric } from "@/app/evaluations/new/types";

jest.mock("@/app/evaluations/new/actions", () => ({
  createEvaluationAction: jest.fn(),
}));

const mockAction = createEvaluationAction as jest.MockedFunction<typeof createEvaluationAction>;

const rubric: ScoreSheetRubric = {
  sections: [
    {
      id: 1,
      code: "CC",
      label: "Call Compliance",
      categories: [
        {
          id: 10,
          label: "Compliance",
          attributes: [
            {
              id: 100,
              label: "Verification",
              errorReasons: [
                { id: 1000, label: "Skipped verification" },
                { id: 1001, label: "Wrong script" },
              ],
            },
          ],
        },
      ],
    },
  ],
};
const agents: ScoreSheetAgent[] = [{ loginId: 5001, agentName: "Test Agent" }];

beforeEach(() => mockAction.mockReset());

describe("ScoreSheetForm (form → derivation boundary)", () => {
  it("tracks the section flag count and submits only enter-only fields", async () => {
    const user = userEvent.setup();
    mockAction.mockResolvedValue({ ok: true, evalId: "E-1" });
    render(<ScoreSheetForm rubric={rubric} agents={agents} defaultQaOwner="me" />);

    expect(screen.getByTestId("section-1-count")).toHaveTextContent("0");

    await user.click(screen.getByLabelText("reason-1000"));
    await user.click(screen.getByLabelText("reason-1001"));
    expect(screen.getByTestId("section-1-count")).toHaveTextContent("2");

    // Unchecking drops the count — proves it is derived from selection, not typed.
    await user.click(screen.getByLabelText("reason-1001"));
    expect(screen.getByTestId("section-1-count")).toHaveTextContent("1");

    await user.selectOptions(screen.getByLabelText("agent"), "5001");
    fireEvent.change(screen.getByLabelText("callDate"), { target: { value: "2025-07-15" } });

    await user.click(screen.getByRole("button", { name: /save score sheet/i }));

    expect(mockAction).toHaveBeenCalledTimes(1);
    const draft = mockAction.mock.calls[0][0];
    expect(draft.agentLoginId).toBe(5001);
    expect(draft.qaOwner).toBe("me");
    expect(draft.callDate).toBe("2025-07-15");
    expect(draft.flaggedReasonIds).toEqual([1000]);
    // No figure ever leaves the form (FR-16 is structural, not validated).
    expect(draft).not.toHaveProperty("sumOfCriticals");
    expect(draft).not.toHaveProperty("overallStatus");
    expect(draft).not.toHaveProperty("failedScorecard");

    expect(await screen.findByText(/Saved evaluation E-1/)).toBeInTheDocument();
  });

  it("disables submit until agent, call date, and QA owner are all set", () => {
    render(<ScoreSheetForm rubric={rubric} agents={agents} defaultQaOwner="" />);
    expect(screen.getByRole("button", { name: /save score sheet/i })).toBeDisabled();
  });

  it("surfaces a rejected save without a success message", async () => {
    const user = userEvent.setup();
    mockAction.mockResolvedValue({
      ok: false,
      message: "No active configuration to score against.",
    });
    render(<ScoreSheetForm rubric={rubric} agents={agents} defaultQaOwner="me" />);

    await user.selectOptions(screen.getByLabelText("agent"), "5001");
    fireEvent.change(screen.getByLabelText("callDate"), { target: { value: "2025-07-15" } });
    await user.click(screen.getByRole("button", { name: /save score sheet/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No active configuration");
    expect(screen.queryByText(/Saved evaluation/)).not.toBeInTheDocument();
  });
});
