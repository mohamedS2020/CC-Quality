"use server";

import { revalidatePath } from "next/cache";
import type { PeriodStatus } from "@prisma/client";
import { authorize } from "@/lib/auth";
import { AuthError } from "@/lib/auth/errors";
import { transitionPeriod } from "@/lib/periods/period";

export type TransitionActionResult = { ok: true } | { ok: false; message: string };

/** Move a period along its lifecycle, gated on `periods.lock` (FR-44/FR-45). */
export async function transitionPeriodAction(
  periodId: number,
  to: PeriodStatus,
): Promise<TransitionActionResult> {
  let userId: number;
  try {
    const ctx = await authorize("periods.lock");
    userId = ctx.user.id;
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        message: error.status === 401 ? "You are not signed in." : "You cannot manage periods.",
      };
    }
    throw error;
  }

  const result = await transitionPeriod(periodId, to, userId);
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/admin/periods");
  return { ok: true };
}
