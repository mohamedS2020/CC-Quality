import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { agentRepository } from "@/lib/db/repositories";
import { isValidEmail, normalizeEmail } from "@/lib/email/address";

/**
 * Agent-dimension management (FR-11). Wraps the repository with the field rules;
 * authorization (`agents.manage`) is enforced by the calling server action.
 * Agents are never hard-deleted — deactivation is a soft flag.
 *
 * The agent's email is where its score / correction / coaching emails go, and
 * the source of truth for an AGENT user's login email: changing it here moves
 * the linked login too, so the two never drift apart.
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

/** "" → null (no email); otherwise normalised and checked. */
function parseEmail(
  raw: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const email = normalizeEmail(raw ?? "");
  if (email === "") return { ok: true, value: null };
  if (!isValidEmail(email)) return { ok: false, error: `"${email}" is not a valid email address.` };
  return { ok: true, value: email };
}

/** The email must not belong to another agent, or to a login that isn't this agent's. */
async function emailTakenBy(email: string, loginId: number): Promise<string | null> {
  const agent = await prisma.agent.findUnique({ where: { email }, select: { loginId: true } });
  if (agent && agent.loginId !== loginId) return `Agent ${agent.loginId} already uses ${email}.`;
  const user = await prisma.user.findUnique({ where: { email }, select: { agentLoginId: true } });
  if (user && user.agentLoginId !== loginId) return `A user account already uses ${email}.`;
  return null;
}

export interface CreateAgentInput {
  loginId: number;
  agentName: string;
  tlName: string;
  joinDate: Date;
  email?: string | null;
}

export async function createAgent(input: CreateAgentInput): Promise<AgentMutationResult> {
  if (!Number.isInteger(input.loginId) || input.loginId <= 0) {
    return { ok: false, error: "Login ID must be a positive whole number." };
  }
  const invalid = validateFields(input.agentName, input.tlName, input.joinDate);
  if (invalid) return { ok: false, error: invalid };
  const email = parseEmail(input.email);
  if (!email.ok) return email;
  if (email.value) {
    const taken = await emailTakenBy(email.value, input.loginId);
    if (taken) return { ok: false, error: taken };
  }

  try {
    const agent = await agentRepository.create({
      loginId: input.loginId,
      agentName: input.agentName.trim(),
      tlName: input.tlName.trim(),
      joinDate: input.joinDate,
      email: email.value,
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
  /** Omitted = leave the email as it is; "" or null = remove it. */
  email?: string | null;
}

export async function updateAgent(
  loginId: number,
  input: UpdateAgentInput,
): Promise<AgentMutationResult> {
  const invalid = validateFields(input.agentName, input.tlName, input.joinDate);
  if (invalid) return { ok: false, error: invalid };

  const existing = await prisma.agent.findUnique({
    where: { loginId },
    include: { user: { select: { id: true } } },
  });
  if (!existing) return { ok: false, error: `No agent with login ID ${loginId}.` };

  const email =
    input.email === undefined
      ? { ok: true as const, value: existing.email }
      : parseEmail(input.email);
  if (!email.ok) return email;

  // A login needs an email, so an agent with an account can't lose theirs.
  if (existing.user && !email.value) {
    return { ok: false, error: "This agent has a login account, so the email can't be empty." };
  }
  if (email.value && email.value !== existing.email) {
    const taken = await emailTakenBy(email.value, loginId);
    if (taken) return { ok: false, error: taken };
  }

  const linkedUser = existing.user;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.agent.update({
        where: { loginId },
        data: {
          agentName: input.agentName.trim(),
          tlName: input.tlName.trim(),
          joinDate: input.joinDate,
          active: input.active,
          email: email.value,
        },
      });
      // Keep the agent's login on the same address (the agent's email wins).
      if (linkedUser && email.value) {
        await tx.user.update({ where: { id: linkedUser.id }, data: { email: email.value } });
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: `${email.value} is already in use.` };
    }
    throw error;
  }
  return { ok: true, loginId };
}
