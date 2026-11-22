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

// --- Email (item 4): short notes to the agent ------------------------------

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

type Note = { subject: string; text: string; html: string };

/** Shared body: greeting, one sentence, and the site link only when there is one. */
function buildNote(subject: string, name: string, sentence: string, appUrl: string | null): Note {
  return {
    subject,
    text:
      `Hi ${name},\n\n${sentence}` +
      (appUrl ? ` You can view it on the website:\n${appUrl}` : "") +
      `\n\n— CC-Quality`,
    html:
      `<p>Hi ${escapeHtml(name)},</p>` +
      `<p>${escapeHtml(sentence)}</p>` +
      (appUrl ? `<p><a href="${escapeHtml(appUrl)}">View it on the website →</a></p>` : "") +
      `<p style="color:#888">— CC-Quality</p>`,
  };
}

/**
 * Pure builder for the score-posted email — no DB/transport, so it's testable.
 * `appUrl` = null for an agent without a login (nothing they could open).
 */
export function buildScoreEmail(name: string, callDate: Date, appUrl: string | null): Note {
  return buildNote(
    "A call was scored for you",
    name,
    `A call from ${ymd(callDate)} has been scored on the QA Scorecard.`,
    appUrl,
  );
}

/** Pure builder for the correction email (same shape as the score email). */
export function buildCorrectionEmail(
  name: string,
  callDate: Date,
  overallStatus: string | null,
  appUrl: string | null,
): Note {
  return buildNote(
    "A scored call was corrected",
    name,
    `Your call from ${ymd(callDate)} was corrected on the QA Scorecard` +
      (overallStatus ? ` and is now ${overallStatus}.` : "."),
    appUrl,
  );
}

/**
 * Where an agent's emails go: the AGENT's email (set on the agent record), so an
 * agent without a login still hears about their calls. The site link is only
 * worth sending to an agent who has an active login.
 */
export async function agentMailTarget(
  agentLoginId: number,
): Promise<{ email: string; name: string; appUrl: string | null } | null> {
  const agent = await prisma.agent.findUnique({
    where: { loginId: agentLoginId },
    select: { email: true, agentName: true, user: { select: { active: true } } },
  });
  if (!agent?.email) return null; // no address on file — nobody to email
  return {
    email: agent.email,
    name: agent.agentName,
    appUrl: agent.user?.active ? (process.env.APP_URL ?? "http://localhost:3000") : null,
  };
}

/**
 * Email the agent that a call was scored (best-effort — never fails scoring).
 * Only the MANUAL scoring action calls this; the bulk importer does not, so an
 * import never floods agents with mail.
 */
export async function emailScorePosted(agentLoginId: number, callDate: Date): Promise<void> {
  try {
    const to = await agentMailTarget(agentLoginId);
    if (!to) return;
    await sendMail({ to: to.email, ...buildScoreEmail(to.name, callDate, to.appUrl) });
  } catch {
    // Best-effort: never let an email error break scoring.
  }
}

/** Email the agent that a call was corrected (best-effort — never fails the correction). */
export async function emailCorrectionPosted(
  agentLoginId: number,
  callDate: Date,
  overallStatus: string | null,
): Promise<void> {
  try {
    const to = await agentMailTarget(agentLoginId);
    if (!to) return;
    await sendMail({
      to: to.email,
      ...buildCorrectionEmail(to.name, callDate, overallStatus, to.appUrl),
    });
  } catch {
    // Best-effort: never let an email error break a correction.
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
