import { render, screen } from "@testing-library/react";
import { SessionProvider, useCan, useSession, type SessionValue } from "@/lib/auth/session-context";

/**
 * The client session hook (task 3.6) is convenience only — it drives showing or
 * disabling controls; the server-side guard remains authoritative. These tests
 * confirm it surfaces the user and gates by effective permissions.
 */
function Probe() {
  const { user } = useSession();
  const can = useCan();
  return (
    <div>
      <span data-testid="user">{user?.email ?? "anon"}</span>
      <span data-testid="config-edit">{String(can("config.edit"))}</span>
      <span data-testid="reports-view">{String(can("reports.view"))}</span>
    </div>
  );
}

function renderWith(value: SessionValue) {
  return render(
    <SessionProvider value={value}>
      <Probe />
    </SessionProvider>,
  );
}

describe("session hook (task 3.6)", () => {
  it("exposes the user and gates controls by effective permissions", () => {
    renderWith({
      user: {
        id: 5,
        email: "mod@x.test",
        name: "Mod",
        role: "MODERATOR",
        active: true,
        agentLoginId: null,
      },
      permissions: ["reports.view"],
    });
    expect(screen.getByTestId("user")).toHaveTextContent("mod@x.test");
    expect(screen.getByTestId("reports-view")).toHaveTextContent("true");
    expect(screen.getByTestId("config-edit")).toHaveTextContent("false");
  });

  it("treats a signed-out session as no user and no permissions", () => {
    renderWith({ user: null, permissions: [] });
    expect(screen.getByTestId("user")).toHaveTextContent("anon");
    expect(screen.getByTestId("reports-view")).toHaveTextContent("false");
  });
});
