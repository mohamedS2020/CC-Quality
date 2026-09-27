"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth";
import { AuthError } from "@/lib/auth/errors";
import { sendCoachingEmail } from "@/lib/coaching/coaching";

export type CoachingActionResult = { ok: true } | { ok: false; message: string };

/** Send a coaching email for a failed call (FR — documented action). `coaching.send`. */
export async function sendCoachingEmailAction(
  evalId: string,
  coachingText: string,
): Promise<CoachingActionResult> {
  let ctx;
  try {
    ctx = await authorize("coaching.send");
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        message:
          error.status === 401
            ? "You are not signed in."
            : "You need the “Send coaching emails” permission.",
      };
    }
    throw error;
  }

  const result = await sendCoachingEmail(evalId, ctx.user.id, coachingText);
  if (result.ok) revalidatePath(`/evaluations/${evalId}`);
  return result.ok ? { ok: true } : { ok: false, message: result.error };
}
