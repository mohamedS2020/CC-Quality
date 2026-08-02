import { Prisma, type UserRole } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { validatePassword } from "@/lib/auth/policy";
import { agentRepository, userRepository } from "@/lib/db/repositories";

/**
 * User-account management (FR-7). Wraps the repository with the account rules:
 * email normalization, password policy, and the AGENT⇄record link (FR-3).
 * Authorization (`users.manage`) is enforced by the server action that calls in.
 */

export type UserMutationResult = { ok: true; id: number } | { ok: false; error: string };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Enforce the AGENT⇄record link rule (FR-3): an AGENT user must link to an
 * existing agent; any other role must not carry a link (so changing a user away
 * from AGENT clears it).
 */
async function resolveAgentLink(
  role: UserRole,
  agentLoginId: number | null | undefined,
): Promise<{ ok: true; value: number | null } | { ok: false; error: string }> {
  if (role !== "AGENT") return { ok: true, value: null };
  if (agentLoginId == null) {
    return { ok: false, error: "An Agent user must be linked to an agent record." };
  }
  const agent = await agentRepository.findByLoginId(agentLoginId);
  if (!agent) return { ok: false, error: `No agent with login id ${agentLoginId}.` };
  return { ok: true, value: agentLoginId };
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
  password: string;
  agentLoginId?: number | null;
}

export async function createUser(input: CreateUserInput): Promise<UserMutationResult> {
  const email = normalizeEmail(input.email);
  if (email === "") return { ok: false, error: "Email is required." };
  if (input.name.trim() === "") return { ok: false, error: "Name is required." };

  const pw = validatePassword(input.password);
  if (!pw.ok) return pw;

  const link = await resolveAgentLink(input.role, input.agentLoginId);
  if (!link.ok) return link;

  if (await userRepository.findByEmail(email)) {
    return { ok: false, error: "A user with that email already exists." };
  }

  try {
    const user = await userRepository.create({
      email,
      name: input.name.trim(),
      role: input.role,
      passwordHash: await hashPassword(input.password),
      agentLoginId: link.value,
    });
    return { ok: true, id: user.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "That email or agent link is already in use." };
    }
    throw error;
  }
}

export interface UpdateUserInput {
  name: string;
  role: UserRole;
  active: boolean;
  agentLoginId?: number | null;
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<UserMutationResult> {
  if (input.name.trim() === "") return { ok: false, error: "Name is required." };

  const existing = await userRepository.findById(id);
  if (!existing) return { ok: false, error: "User not found." };

  const link = await resolveAgentLink(input.role, input.agentLoginId);
  if (!link.ok) return link;

  try {
    await userRepository.update(id, {
      name: input.name.trim(),
      role: input.role,
      active: input.active,
      agentLoginId: link.value,
    });
    return { ok: true, id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "That agent is already linked to another user." };
    }
    throw error;
  }
}

/** Replace a Moderator's granular permission grants (FR-8). */
export function setUserPermissions(userId: number, keys: readonly string[]): Promise<void> {
  return userRepository.setGrantedPermissions(userId, keys);
}
