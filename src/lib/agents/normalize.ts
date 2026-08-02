import type { Agent } from "@prisma/client";
import { prisma } from "@/lib/db/client";

/**
 * The Data Standard name normalizer (§13, FR-12), shared by the score-sheet
 * entry flow and the importer. It resolves a raw agent name — including Arabic
 * or alternate spellings held in the alias table — to its canonical Agent.
 */

/** Canonicalize a raw name for matching: trim and collapse internal whitespace. */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Match key: normalized + lowercased (lowercasing is a harmless no-op for Arabic). */
function matchKey(raw: string): string {
  return normalizeName(raw).toLowerCase();
}

export interface AgentResolver {
  resolve(rawName: string): Agent | null;
  resolveByLoginId(loginId: number): Agent | null;
}

/**
 * Preload every agent and its aliases into an in-memory lookup so a bulk import
 * resolves many rows (by login_id or name) without a query per row. Aliases are
 * inserted first and canonical names last, so a real canonical name always wins
 * any accidental collision with an alias.
 */
export async function buildAgentResolver(): Promise<AgentResolver> {
  const agents = await prisma.agent.findMany({ include: { aliases: true } });
  const byKey = new Map<string, Agent>();
  const byLoginId = new Map<number, Agent>();
  for (const agent of agents) {
    byLoginId.set(agent.loginId, agent);
    for (const alias of agent.aliases) byKey.set(matchKey(alias.alias), agent);
  }
  for (const agent of agents) byKey.set(matchKey(agent.agentName), agent);

  return {
    resolve(rawName: string): Agent | null {
      const key = matchKey(rawName);
      return key === "" ? null : (byKey.get(key) ?? null);
    },
    resolveByLoginId(loginId: number): Agent | null {
      return byLoginId.get(loginId) ?? null;
    },
  };
}

/** Resolve a single raw name to its canonical agent, or null if unknown. */
export async function resolveAgentByName(rawName: string): Promise<Agent | null> {
  const resolver = await buildAgentResolver();
  return resolver.resolve(rawName);
}
