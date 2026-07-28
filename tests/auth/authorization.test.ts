/**
 * @jest-environment node
 */
import type { AuthContext, PublicUser } from "@/lib/auth/context";
import { checkAuthorization } from "@/lib/auth/context";
import { AuthError } from "@/lib/auth/errors";
import type { PermissionKey } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/client";
import { userRepository } from "@/lib/db/repositories";

const TEST_EMAIL = "rbac-authz@cc-quality.test";
const TEST_PERMISSION_KEY = "rbac.test.grant"; // deliberately outside the catalog

function moderatorCtx(keys: string[]): AuthContext {
  const user: PublicUser = {
    id: 1,
    email: TEST_EMAIL,
    name: "Mod",
    role: "MODERATOR",
    active: true,
    agentLoginId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { user, permissions: new Set(keys as PermissionKey[]) };
}

/** The AuthError status a call throws, or "allowed" if it returns normally. */
function statusOf(fn: () => unknown): number | "allowed" {
  try {
    fn();
    return "allowed";
  } catch (error) {
    return error instanceof AuthError ? error.status : -1;
  }
}

async function cleanup() {
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (user) await prisma.user.delete({ where: { id: user.id } });
  await prisma.permission.deleteMany({ where: { key: TEST_PERMISSION_KEY } });
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("authorization decision (FR-10)", () => {
  it("returns 401 when unauthenticated", () => {
    expect(statusOf(() => checkAuthorization(null))).toBe(401);
    expect(statusOf(() => checkAuthorization(null, "reports.view"))).toBe(401);
  });

  it("returns 403 when authenticated but missing the required permission", () => {
    expect(statusOf(() => checkAuthorization(moderatorCtx([]), "config.edit"))).toBe(403);
    expect(statusOf(() => checkAuthorization(moderatorCtx(["reports.view"]), "config.edit"))).toBe(
      403,
    );
  });

  it("allows when the permission is held, or when no permission is required", () => {
    expect(statusOf(() => checkAuthorization(moderatorCtx(["config.edit"]), "config.edit"))).toBe(
      "allowed",
    );
    expect(statusOf(() => checkAuthorization(moderatorCtx([])))).toBe("allowed");
  });
});

describe("moderator grant loading (FR-8)", () => {
  it("loads exactly the permission keys granted to a user", async () => {
    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, name: "Mod", role: "MODERATOR", passwordHash: "x" },
    });
    const permission = await prisma.permission.create({
      data: { key: TEST_PERMISSION_KEY, label: "RBAC Test", description: "test grant" },
    });
    await prisma.userPermission.create({
      data: { userId: user.id, permissionId: permission.id },
    });

    expect(await userRepository.getGrantedPermissionKeys(user.id)).toEqual([TEST_PERMISSION_KEY]);
  });

  it("returns no keys for a user without grants", async () => {
    const email = "rbac-authz-nogrants@cc-quality.test";
    await prisma.user.deleteMany({ where: { email } });
    const user = await prisma.user.create({
      data: { email, name: "NoGrants", role: "MODERATOR", passwordHash: "x" },
    });
    try {
      expect(await userRepository.getGrantedPermissionKeys(user.id)).toEqual([]);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
