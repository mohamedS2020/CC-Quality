import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/db/client";

/**
 * Data-access for user accounts and their permission grants (task 7). Feature
 * code goes through these typed functions rather than touching Prisma directly.
 */
export const userRepository = {
  findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  },

  /** All users with their linked agent (for the admin list, FR-7). */
  list() {
    return prisma.user.findMany({
      orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
      include: { agent: { select: { loginId: true, agentName: true } } },
    });
  },

  create(data: Prisma.UserUncheckedCreateInput): Promise<User> {
    return prisma.user.create({ data });
  },

  update(id: number, data: Prisma.UserUncheckedUpdateInput): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  },

  /** The permission keys explicitly granted to a user (the Moderator toggles, FR-8). */
  async getGrantedPermissionKeys(userId: number): Promise<string[]> {
    const rows = await prisma.userPermission.findMany({
      where: { userId },
      select: { permission: { select: { key: true } } },
    });
    return rows.map((row) => row.permission.key);
  },

  /**
   * Replace a user's granted permissions with exactly `keys` (FR-8). Resolves
   * keys to catalog rows, so an unknown key is silently ignored rather than
   * creating a dangling grant. Runs in one transaction; takes effect on the
   * user's next request (permissions are resolved per-request, not cached).
   */
  async setGrantedPermissions(userId: number, keys: readonly string[]): Promise<void> {
    const permissions = await prisma.permission.findMany({
      where: { key: { in: [...keys] } },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.userPermission.deleteMany({ where: { userId } }),
      prisma.userPermission.createMany({
        data: permissions.map((p) => ({ userId, permissionId: p.id })),
      }),
    ]);
  },
};
