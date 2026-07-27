import { render, screen } from "@testing-library/react";
import { prisma } from "@/lib/db/client";

/**
 * Smoke test for the test harness itself (task 1.4). Proves that:
 *  - Jest runs TypeScript,
 *  - the "@/" path alias resolves to src/,
 *  - the jsdom environment + React Testing Library + jest-dom matchers work.
 */
describe("test harness smoke", () => {
  it("runs TypeScript unit tests", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves the @/ path alias and loads the Prisma client module", () => {
    expect(prisma).toBeDefined();
  });

  it("renders React components (jsdom + Testing Library + jest-dom)", () => {
    render(<h1>QA Scorecard</h1>);
    expect(screen.getByRole("heading", { name: /qa scorecard/i })).toBeInTheDocument();
  });
});
