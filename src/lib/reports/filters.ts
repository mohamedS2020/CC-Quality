import { prisma } from "@/lib/db/client";

/** Periods that have at least one scored call, newest first (for the picker). */
export function reportPeriods() {
  return prisma.period.findMany({
    where: { evaluations: { some: { supersededAt: null } } },
    orderBy: [{ label: "desc" }],
    select: { id: true, label: true },
  });
}

/** Distinct team leaders across the agent roster (the TL scope options). */
export async function teamLeads(): Promise<string[]> {
  const rows = await prisma.agent.findMany({
    distinct: ["tlName"],
    orderBy: [{ tlName: "asc" }],
    select: { tlName: true },
  });
  return rows.map((r) => r.tlName);
}

/** Agents (optionally within a TL) for the agent scope picker. */
export function reportAgents(tlName?: string) {
  return prisma.agent.findMany({
    where: tlName ? { tlName } : undefined,
    orderBy: [{ agentName: "asc" }],
    select: { loginId: true, agentName: true, tlName: true },
  });
}
