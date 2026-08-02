"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth";
import {
  getNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/service";

/** Mark every one of the caller's notifications read (FR-41). */
export async function markAllReadAction(): Promise<void> {
  const ctx = await authorize();
  await markAllNotificationsRead(ctx.user.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout"); // refresh the sidebar badge
}

/** Open a notification: mark it read, then deep-link to the scored call (FR-40). */
export async function openNotificationAction(id: number): Promise<void> {
  const ctx = await authorize();
  const notification = await getNotification(id, ctx.user.id);
  await markNotificationRead(id, ctx.user.id);
  redirect(
    notification?.evaluationId ? `/evaluations/${notification.evaluationId}` : "/notifications",
  );
}
