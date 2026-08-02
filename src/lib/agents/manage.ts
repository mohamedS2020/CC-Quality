import { Prisma } from "@prisma/client";
import { agentRepository } from "@/lib/db/repositories";

/**
 * Agent-dimension management (FR-11). Wraps the repository with the field rules;
 * authorization (`agents.manage`) is enforced by the calling server action.
 * Agents are never hard-deleted — deactivation is a soft flag.
 */

export type AgentMutationResult = { ok: true; loginId: number } | { ok: false; error: string };

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function validateFields(agentName: string, tlName: string, joinDate: Date): string | null {
  if (agentName.trim() === "") return "Agent name is required.";
  if (tlName.trim() === "") return "Team leader name is required.";
  if (Number.isNaN(joinDate.getTime())) return "A valid join date is required.";
  return null;
}

export interface CreateAgentInput {
  loginId: number;
  agentName: string;
  tlName: string;
  joinDate: Date;
}

export async function createAgent(input: CreateAgentInput): Promise<AgentMutationResult> {
  if (!Number.isInteger(input.loginId) || input.loginId <= 0) {
    return { ok: false, error: "Login ID must be a positive whole number." };
  }
  const invalid = validateFields(input.agentName, input.tlName, input.joinDate);
  if (invalid) return { ok: false, error: invalid };

  try {
    const agent = await agentRepository.create({
      loginId: input.loginId,
      agentName: input.agentName.trim(),
      tlName: input.tlName.trim(),
      joinDate: input.joinDate,
    });
    return { ok: true, loginId: agent.loginId };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: `An agent with login ID ${input.loginId} already exists.` };
    }
    throw error;
  }
}

export interface UpdateAgentInput {
  agentName: string;
  tlName: string;
  joinDate: Date;
  active: boolean;
}

export async function updateAgent(
  loginId: number,
  input: UpdateAgentInput,
): Promise<AgentMutationResult> {
  const invalid = validateFields(input.agentName, input.tlName, input.joinDate);
  if (invalid) return { ok: false, error: invalid };

  const existing = await agentRepository.findByLoginId(loginId);
  if (!existing) return { ok: false, error: `No agent with login ID ${loginId}.` };

  await agentRepository.update(loginId, {
    agentName: input.agentName.trim(),
    tlName: input.tlName.trim(),
    joinDate: input.joinDate,
    active: input.active,
  });
  return { ok: true, loginId };
}
