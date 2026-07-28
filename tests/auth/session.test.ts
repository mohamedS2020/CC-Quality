/**
 * @jest-environment node
 *
 * Session + password coverage for the auth layer (tasks 3.1/3.2): argon2id
 * hashing, DB-backed sessions with sliding inactivity expiry, deactivation, and
 * admin-initiated reset.
 */
import { prisma } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  hashToken,
  invalidateSession,
  validateSessionToken,
} from "@/lib/auth/session";
import { resetPassword } from "@/lib/auth/account";

const TEST_EMAIL = "rbac-session@cc-quality.test";

async function cleanup() {
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (user) {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

const makeUser = (passwordHash = "placeholder") =>
  prisma.user.create({
    data: { email: TEST_EMAIL, name: "Session", role: "MODERATOR", passwordHash },
  });

beforeAll(cleanup);
afterEach(cleanup);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("password hashing (3.1)", () => {
  it("hashes with argon2id and verifies correctly", async () => {
    const hash = await hashPassword("Secret123!");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "Secret123!")).toBe(true);
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });
});

describe("session lifecycle (3.1)", () => {
  it("creates, validates, then invalidates a session (logout)", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);

    expect((await validateSessionToken(token)).user?.id).toBe(user.id);

    await invalidateSession(hashToken(token));
    expect((await validateSessionToken(token)).user).toBeNull();
  });

  it("expires an idle session and removes the row (FR-5)", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);
    await prisma.session.update({
      where: { id: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect((await validateSessionToken(token)).user).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: hashToken(token) } })).toBeNull();
  });

  it("rejects a valid session belonging to a deactivated account", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { active: false } });

    expect((await validateSessionToken(token)).user).toBeNull();
  });
});

describe("admin password reset (3.2)", () => {
  it("rejects a password below the policy minimum", async () => {
    const user = await makeUser();
    expect((await resetPassword(user.id, "short")).ok).toBe(false);
  });

  it("sets the new password, revokes the old one, and kills existing sessions", async () => {
    const user = await makeUser(await hashPassword("original-pass"));
    const { token } = await createSession(user.id);
    expect((await validateSessionToken(token)).user?.id).toBe(user.id);

    expect((await resetPassword(user.id, "new-strong-pass")).ok).toBe(true);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(updated.passwordHash, "new-strong-pass")).toBe(true);
    expect(await verifyPassword(updated.passwordHash, "original-pass")).toBe(false);
    expect((await validateSessionToken(token)).user).toBeNull();
  });
});
