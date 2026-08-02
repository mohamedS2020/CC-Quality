/**
 * App-shell navigation (professional nav): renders only for authenticated users,
 * shows exactly the sections the caller can reach (permission-gated), highlights
 * the active route by longest-prefix match, and surfaces the user + sign-out.
 */
import { render, screen } from "@testing-library/react";
import { AppShell } from "@/app/app-shell";
import { SessionProvider, type SessionValue } from "@/lib/auth/session-context";
import { ALL_PERMISSION_KEYS, AGENT_PERMISSIONS } from "@/lib/auth/permissions";

let mockPathname = "/";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
jest.mock("@/app/login/actions", () => ({ logoutAction: jest.fn() }));

function renderShell(session: SessionValue, pathname = "/") {
  mockPathname = pathname;
  return render(
    <SessionProvider value={session}>
      <AppShell>
        <div>PAGE BODY</div>
      </AppShell>
    </SessionProvider>,
  );
}

const admin: SessionValue = {
  user: {
    id: 1,
    email: "ada@x.com",
    name: "Ada Admin",
    role: "ADMIN",
    active: true,
    agentLoginId: null,
  },
  permissions: [...ALL_PERMISSION_KEYS],
};

const agent: SessionValue = {
  user: {
    id: 2,
    email: "gus@x.com",
    name: "Gus Agent",
    role: "AGENT",
    active: true,
    agentLoginId: 5001,
  },
  permissions: [...AGENT_PERMISSIONS],
};

describe("AppShell", () => {
  it("renders the page without chrome when signed out", () => {
    renderShell({ user: null, permissions: [] });
    expect(screen.getByText("PAGE BODY")).toBeInTheDocument();
    expect(screen.queryByText("QA Scorecard")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Evaluations" })).not.toBeInTheDocument();
  });

  it("shows every section to an Admin, with the user card and sign-out", () => {
    renderShell(admin);
    for (const name of [
      "Home",
      "Evaluations",
      "New score sheet",
      "Import",
      "Configuration",
      "Periods",
      "Agents",
      "Users",
    ]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    expect(screen.getByText("Ada Admin")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("AA")).toBeInTheDocument(); // avatar initials
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("hides sections an Agent cannot reach (self-scope)", () => {
    renderShell(agent);
    expect(screen.getByRole("link", { name: "Evaluations" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    for (const name of [
      "New score sheet",
      "Import",
      "Configuration",
      "Users",
      "Agents",
      "Periods",
    ]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
  });

  it("marks the active route, resolving nested paths to the most specific item", () => {
    renderShell(admin, "/evaluations/new");
    expect(screen.getByRole("link", { name: "New score sheet" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // The parent /evaluations item must NOT also be active.
    expect(screen.getByRole("link", { name: "Evaluations" })).not.toHaveAttribute("aria-current");
  });

  it("marks a top-level route active without bleeding into siblings", () => {
    renderShell(admin, "/admin/agents");
    expect(screen.getByRole("link", { name: "Agents" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });
});
