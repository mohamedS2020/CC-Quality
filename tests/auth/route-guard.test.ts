/**
 * @jest-environment node
 *
 * Verifies the route wrapper turns an authorization failure into the right HTTP
 * status WITHOUT running the handler — so a denied endpoint returns 403/401 and
 * never assembles or leaks protected data (FR-10). `authorize` (which reads the
 * request cookie) is mocked so the wrapper's mapping can be tested in isolation.
 */
import { AuthError } from "@/lib/auth/errors";
import type { AuthContext } from "@/lib/auth/context";

jest.mock("@/lib/auth", () => ({
  authorize: jest.fn(),
}));

import { authorize } from "@/lib/auth";
import { withPermission } from "@/lib/auth/http";

const mockedAuthorize = authorize as jest.MockedFunction<typeof authorize>;

const adminContext: AuthContext = {
  user: {
    id: 1,
    email: "admin@test",
    name: "Admin",
    role: "ADMIN",
    active: true,
    agentLoginId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  permissions: new Set(),
};

beforeEach(() => mockedAuthorize.mockReset());

describe("route guard (denied endpoint -> 403/401, no partial data)", () => {
  it("returns 403 and never runs the handler when the permission is missing", async () => {
    mockedAuthorize.mockRejectedValue(new AuthError(403, "forbidden"));
    const handler = jest.fn(() => new Response("secret-data"));

    const route = withPermission("users.manage", handler);
    const res = await route(new Request("http://test/"));

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ error: "forbidden" });
  });

  it("returns 401 when unauthenticated", async () => {
    mockedAuthorize.mockRejectedValue(new AuthError(401, "auth required"));
    const handler = jest.fn(() => new Response("ok"));

    const res = await withPermission(undefined, handler)(new Request("http://test/"));

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the handler and returns its response when authorized", async () => {
    mockedAuthorize.mockResolvedValue(adminContext);

    const route = withPermission("users.manage", (ctx) => Response.json({ email: ctx.user.email }));
    const res = await route(new Request("http://test/"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "admin@test" });
  });
});
