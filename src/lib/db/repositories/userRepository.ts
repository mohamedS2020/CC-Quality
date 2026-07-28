import type { User } from "@prisma/client";
import { prisma } from "@/lib/db/client";

/**
 * Data-access for user accounts and their permission grants. Grows as user
 * management (task 7) lands; for now it backs the authorization guard.
 */
export const userRepository = {
  findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  },

  /** The permission keys explicitly granted to a user (the Moderator toggles, FR-8). */
  async getGrantedPermissionKeys(userId: number): Promise<string[]> {
    const rows = await prisma.userPermission.findMany({
      where: { userId },
      select: { permission: { select: { key: true } } },
    });
    return rows.map((row) => row.permission.key);
  },
};
