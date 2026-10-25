"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth";
import { AuthError } from "@/lib/auth/errors";
import { setCallTypes, setCoachingCc, setMonitoringTypes } from "@/lib/settings/settings";

/**
 * Direct-save actions for the non-versioned operational settings (call types,
 * monitoring types, coaching CC). Editing these never mints a new config version. Gated by
 * `config.edit`.
 */

export type SettingsResult = { ok: true } | { ok: false; message: string };

async function guard(): Promise<SettingsResult | null> {
  try {
    await authorize("config.edit");
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        message:
          error.status === 401
            ? "You are not signed in."
            : "You need the “Edit configuration” permission.",
      };
    }
    throw error;
  }
}

export async function saveCallTypesAction(callTypes: string[]): Promise<SettingsResult> {
  const denied = await guard();
  if (denied) return denied;
  await setCallTypes(callTypes);
  revalidatePath("/admin/config");
  return { ok: true };
}

export async function saveMonitoringTypesAction(
  monitoringTypes: string[],
): Promise<SettingsResult> {
  const denied = await guard();
  if (denied) return denied;
  await setMonitoringTypes(monitoringTypes);
  revalidatePath("/admin/config");
  return { ok: true };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function saveCoachingCcAction(emails: string[]): Promise<SettingsResult> {
  const denied = await guard();
  if (denied) return denied;
  const clean = emails.map((e) => e.trim()).filter((e) => e !== "");
  const invalid = clean.find((e) => !EMAIL.test(e));
  if (invalid) return { ok: false, message: `"${invalid}" is not a valid email address.` };
  await setCoachingCc(clean);
  revalidatePath("/admin/config");
  return { ok: true };
}
