import type { Agent, AgentAlias, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

/**
 * Data-access layer for the AGENT dimension (+ its name aliases).
 *
 * Repositories are the ONLY place raw Prisma queries live; feature code calls
 * these typed functions instead of touching the client directly. This keeps
 * query logic in one testable place and lets us extend persistence without
 * changing callers. Add one module per aggregate as features need it — this
 * is the pattern the rest of the DAL follows (task 2.8).
 */
export const agentRepository = {
  create(data: Prisma.AgentCreateInput): Promise<Agent> {
    return prisma.agent.create({ data });
  },

  findByLoginId(loginId: number): Promise<Agent | null> {
    return prisma.agent.findUnique({ where: { loginId } });
  },

  findByLoginIdWithAliases(loginId: number) {
    return prisma.agent.findUnique({
      where: { loginId },
      include: { aliases: true },
    });
  },

  list(options?: { activeOnly?: boolean }): Promise<Agent[]> {
    return prisma.agent.findMany({
      where: options?.activeOnly ? { active: true } : undefined,
      orderBy: { agentName: "asc" },
    });
  },

  update(loginId: number, data: Prisma.AgentUpdateInput): Promise<Agent> {
    return prisma.agent.update({ where: { loginId }, data });
  },

  /** Soft-deactivate (FR-11) — agents are never hard-deleted. */
  deactivate(loginId: number): Promise<Agent> {
    return prisma.agent.update({ where: { loginId }, data: { active: false } });
  },

  /** Register an alternate spelling that resolves to this agent (Data Standard, §13). */
  addAlias(loginId: number, alias: string): Promise<AgentAlias> {
    return prisma.agentAlias.create({ data: { alias, agentId: loginId } });
  },

  /** Resolve an agent by one of its aliases (used by the import normalizer, task 6.3). */
  findByAlias(alias: string): Promise<Agent | null> {
    return prisma.agent.findFirst({ where: { aliases: { some: { alias } } } });
  },
};
