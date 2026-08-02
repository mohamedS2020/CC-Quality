import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { evaluationScopeWhere, type AgentScope } from "@/lib/auth/scope";

// A flagged line resolved down to its section/attribute labels, for display.
const lineInclude = {
  errorReason: {
    include: { attribute: { include: { category: { include: { section: true } } } } },
  },
} as const;

const versionInclude = {
  agent: true,
  correctedBy: { select: { id: true, name: true } },
  lines: { include: lineInclude },
} satisfies Prisma.EvaluationInclude;

/** One version of a call, with agent, corrector, and labelled flagged lines. */
export type EvaluationVersion = Prisma.EvaluationGetPayload<{ include: typeof versionInclude }>;

/**
 * The CURRENT version of every call (FR-14) — superseded rows are hidden, so a
 * corrected call appears once, at its latest version. Newest calls first. A
 * `scope` restricts the rows to an Agent's own calls (FR-9); omit it for the
 * Admin/Moderator view.
 */
export function listCurrentEvaluations(scope?: AgentScope) {
  return prisma.evaluation.findMany({
    where: { supersededAt: null, ...(scope ? evaluationScopeWhere(scope) : {}) },
    orderBy: [{ callDate: "desc" }, { creationDate: "desc" }],
    include: {
      agent: { select: { agentName: true } },
      correctedBy: { select: { name: true } },
    },
  });
}

/**
 * The full version history of a call (the audit trail, FR-15), ordered original
 * → latest, resolved from ANY version in the chain. Walks back to the original
 * via `correctionOfId`, then forward via the corrections link — chains are short
 * (a call is rarely corrected more than once or twice).
 */
export async function getEvaluationHistory(evalId: string) {
  const seed = await prisma.evaluation.findUnique({
    where: { evalId },
    select: { evalId: true, correctionOfId: true },
  });
  if (!seed) return null;

  // Walk back to the original (the row that corrects nothing).
  let rootId = seed.evalId;
  let cursorBack: string | null = seed.correctionOfId;
  while (cursorBack) {
    const prev: { evalId: string; correctionOfId: string | null } | null =
      await prisma.evaluation.findUnique({
        where: { evalId: cursorBack },
        select: { evalId: true, correctionOfId: true },
      });
    if (!prev) break;
    rootId = prev.evalId;
    cursorBack = prev.correctionOfId;
  }

  // Walk forward collecting every version with display detail.
  const chain: EvaluationVersion[] = [];
  let cursor: string | null = rootId;
  while (cursor) {
    const node = await prisma.evaluation.findUnique({
      where: { evalId: cursor },
      include: versionInclude,
    });
    if (!node) break;
    chain.push(node);
    const next: { evalId: string } | null = await prisma.evaluation.findFirst({
      where: { correctionOfId: cursor },
      select: { evalId: true },
    });
    cursor = next?.evalId ?? null;
  }
  return chain;
}
