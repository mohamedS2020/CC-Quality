"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";

export type LoginFormState = { error: string | null };

/** Server action backing the login form (used with `useActionState`). */
export async function loginAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email.trim() || !password) {
    return { error: "Email and password are required." };
  }

  const result = await login(email, password);
  if (!result.ok) return { error: result.error };

  // On success `login` has set the session cookie; send the user home.
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}
