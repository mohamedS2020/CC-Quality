"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import { authorize, resetPassword } from "@/lib/auth";
import { AuthError } from "@/lib/auth/errors";
import { isPermissionKey } from "@/lib/auth/permissions";
import { createUser, setUserPermissions, updateUser } from "@/lib/users/service";

export type UserActionResult = { ok: true; id: number } | { ok: false; message: string };
export type SimpleResult = { ok: true } | { ok: false; message: string };

export interface UserFormInput {
  email: string;
  name: string;
  role: UserRole;
  agentLoginId?: number | null;
}

type Caller = { ok: true; userId: number } | { ok: false; message: string };

async function guard(): Promise<Caller> {
  try {
    const ctx = await authorize("users.manage");
    return { ok: true, userId: ctx.user.id };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        message: error.status === 401 ? "You are not signed in." : "You cannot manage users.",
      };
    }
    throw error;
  }
}

export async function createUserAction(
  input: UserFormInput & { password: string },
): Promise<UserActionResult> {
  const caller = await guard();
  if (!caller.ok) return { ok: false, message: caller.message };

  const result = await createUser({
    email: input.email,
    name: input.name,
    role: input.role,
    password: input.password,
    agentLoginId: input.agentLoginId ?? null,
  });
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/admin/users");
  return { ok: true, id: result.id };
}

export async function updateUserAction(
  id: number,
  input: UserFormInput & { active: boolean },
): Promise<UserActionResult> {
  const caller = await guard();
  if (!caller.ok) return { ok: false, message: caller.message };

  // Guard against self-lockout: an admin can't demote or deactivate themselves.
  if (id === caller.userId) {
    if (input.role !== "ADMIN") {
      return { ok: false, message: "You cannot change your own role." };
    }
    if (!input.active) {
      return { ok: false, message: "You cannot deactivate your own account." };
    }
  }

  const result = await updateUser(id, {
    name: input.name,
    role: input.role,
    active: input.active,
    agentLoginId: input.agentLoginId ?? null,
  });
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return { ok: true, id: result.id };
}

export async function setPermissionsAction(id: number, keys: string[]): Promise<SimpleResult> {
  const caller = await guard();
  if (!caller.ok) return { ok: false, message: caller.message };

  await setUserPermissions(id, keys.filter(isPermissionKey));
  revalidatePath(`/admin/users/${id}`);
  return { ok: true };
}

export async function resetPasswordAction(id: number, password: string): Promise<SimpleResult> {
  const caller = await guard();
  if (!caller.ok) return { ok: false, message: caller.message };

  const result = await resetPassword(id, password);
  return result.ok ? { ok: true } : { ok: false, message: result.error };
}
