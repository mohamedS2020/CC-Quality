"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth";
import { AuthError } from "@/lib/auth/errors";
import { createAgent, updateAgent } from "@/lib/agents/manage";

export type AgentActionResult = { ok: true; loginId: number } | { ok: false; message: string };

export interface AgentFormInput {
  agentName: string;
  tlName: string;
  joinDate: string; // yyyy-mm-dd
}

async function guard(): Promise<string | null> {
  try {
    await authorize("agents.manage");
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401 ? "You are not signed in." : "You cannot manage agents.";
    }
    throw error;
  }
}

export async function createAgentAction(
  input: AgentFormInput & { loginId: number },
): Promise<AgentActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, message: denied };

  const result = await createAgent({
    loginId: input.loginId,
    agentName: input.agentName,
    tlName: input.tlName,
    joinDate: new Date(input.joinDate),
  });
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/admin/agents");
  return { ok: true, loginId: result.loginId };
}

export async function updateAgentAction(
  loginId: number,
  input: AgentFormInput & { active: boolean },
): Promise<AgentActionResult> {
  const denied = await guard();
  if (denied) return { ok: false, message: denied };

  const result = await updateAgent(loginId, {
    agentName: input.agentName,
    tlName: input.tlName,
    joinDate: new Date(input.joinDate),
    active: input.active,
  });
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/admin/agents");
  revalidatePath(`/admin/agents/${loginId}`);
  return { ok: true, loginId: result.loginId };
}
