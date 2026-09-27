import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { sendMail } from "@/lib/email/mailer";

/**
 * In-app notifications (FR-39/40/41). A scored or corrected call notifies the
 * AGENT USER linked to that agent (if the agent has a linked account). Creation
 * is **best-effort**: a notification failure never fails the scoring/correction
 * that triggered it. Notifications are strictly per-user — every read query is
 * scoped by `userId`, so an agent only ever sees their own.
 */

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function notifyAgentUser(
  agentLoginId: number,
  type: NotificationType,
  evaluationId: string,
  message: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { agentLoginId },
      select: { id: true },
    });
    if (!user) return; // agent has no linked account — nobody to notify
    await prisma.notification.create({ data: { userId: user.id, type, evaluationId, message } });
  } catch {
    // Best-effort: never let a notification error break scoring.
  }
}

export function notifyScorePosted(
  agentLoginId: number,
  evaluationId: string,
  overallStatus: string | null,
  callDate: Date,
): Promise<void> {
  return notifyAgentUser(
    agentLoginId,
    NotificationType.SCORE_POSTED,
    evaluationId,
    `Your call on ${ymd(callDate)} was scored — ${overallStatus ?? "scored"}.`,
  );
}

export function notifyCorrectionPosted(
  agentLoginId: number,
  evaluationId: string,
  overallStatus: string | null,
  callDate: Date,
): Promise<void> {
  return notifyAgentUser(
    agentLoginId,
    NotificationType.CORRECTION_POSTED,
    evaluationId,
    `Your call on ${ymd(callDate)} was corrected — now ${overallStatus ?? "updated"}.`,
  );
}

// --- Email (item 4): a short "your call was scored" note to the agent --------

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

/** Pure builder for the score-posted email — no DB/transport, so it's testable. */
export function buildScoreEmail(
  name: string,
  callDate: Date,
  appUrl: string,
): { subject: string; text: string; html: string } {
  const date = ymd(callDate);
  return {
    subject: "A call was scored for you",
    text:
      `Hi ${name},\n\n` +
      `A call from ${date} has been scored on the QA Scorecard. ` +
      `You can view it on the website:\n${appUrl}\n\n— CC-Quality`,
    html:
      `<p>Hi ${escapeHtml(name)},</p>` +
      `<p>A call from <strong>${date}</strong> has been scored on the QA Scorecard.</p>` +
      `<p><a href="${appUrl}">View it on the website →</a></p>` +
      `<p style="color:#888">— CC-Quality</p>`,
  };
}

/**
 * Email the agent's linked user that a call was scored (best-effort — never
 * fails scoring). Only the MANUAL scoring action calls this; the bulk importer
 * does not, so an import never floods agents with mail.
 */
export async function emailScorePosted(agentLoginId: number, callDate: Date): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { agentLoginId },
      select: { email: true, name: true, active: true },
    });
    if (!user || !user.active) return; // no linked/active account — nobody to email
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const { subject, text, html } = buildScoreEmail(user.name, callDate, appUrl);
    await sendMail({ to: user.email, subject, text, html });
  } catch {
    // Best-effort: never let an email error break scoring.
  }
}

// --- Read side (all scoped by userId) --------------------------------------

export function unreadNotificationCount(userId: number): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export function listNotifications(userId: number) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });
}

export function getNotification(id: number, userId: number) {
  return prisma.notification.findFirst({ where: { id, userId } });
}

export async function markNotificationRead(id: number, userId: number): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
