import "server-only";
import { prisma } from "@/lib/db/client";
import { sendMail } from "@/lib/email/mailer";
import { displayMobile } from "@/lib/pii";
import { getCoachingCc } from "@/lib/settings/settings";

/**
 * Coaching email (documented action, failed calls only). Composes a professional
 * note to the agent with the call data, the failed sections + their failing
 * attributes, the scorer, the sender, and the sender's coaching text; CC's the
 * configured recipients; then stamps the evaluation as coached. One per version.
 */

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export interface CoachingSection {
  code: string;
  label: string;
  items: { attribute: string; reason: string }[];
}

export interface CoachingEmailData {
  agentName: string;
  senderName: string;
  scorer: string;
  callDate: Date;
  phoneMasked: string | null;
  callType: string | null;
  overallStatus: string;
  failedSections: CoachingSection[];
  coachingText: string;
  appUrl: string;
}

/** Pure builder — no DB/transport, so it's unit-testable. */
export function buildCoachingEmail(d: CoachingEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const date = ymd(d.callDate);
  const phone = displayMobile(d.phoneMasked);
  const callType = d.callType ?? "—";

  const areasText = d.failedSections
    .map(
      (s) =>
        `${s.code} — ${s.label}:\n` +
        s.items.map((i) => `  • ${i.attribute}: ${i.reason}`).join("\n"),
    )
    .join("\n\n");

  const text =
    `Dear ${d.agentName},\n\n` +
    `This is a coaching note regarding your call scored on ${date} (result: ${d.overallStatus}).\n\n` +
    `Call details\n` +
    `- Date: ${date}\n- Phone: ${phone}\n- Call type: ${callType}\n- Result: ${d.overallStatus}\n- Scored by: ${d.scorer}\n\n` +
    `Areas to improve\n${areasText}\n\n` +
    `Coaching notes\n${d.coachingText}\n\n` +
    `You can review the full scorecard on the site: ${d.appUrl}\n\n` +
    `Sent by ${d.senderName} — CC-Quality`;

  const row = (k: string, v: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td style="padding:4px 0"><strong>${esc(v)}</strong></td></tr>`;

  const areasHtml = d.failedSections
    .map(
      (s) =>
        `<div style="margin:10px 0"><div style="font-weight:600">${esc(s.code)} — ${esc(s.label)}</div>` +
        `<ul style="margin:6px 0 0;padding-left:20px">` +
        s.items
          .map((i) => `<li><strong>${esc(i.attribute)}</strong> — ${esc(i.reason)}</li>`)
          .join("") +
        `</ul></div>`,
    )
    .join("");

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1f26;max-width:640px">` +
    `<div style="background:#1f2937;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0"><h2 style="margin:0;font-size:18px">Coaching note</h2></div>` +
    `<div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:18px 20px">` +
    `<p>Dear ${esc(d.agentName)},</p>` +
    `<p>This is a coaching note regarding your call scored on <strong>${date}</strong> (result: <strong>${esc(d.overallStatus)}</strong>).</p>` +
    `<h3 style="font-size:14px;margin:16px 0 4px">Call details</h3>` +
    `<table style="border-collapse:collapse;font-size:14px">${row("Date", date)}${row("Phone", phone)}${row("Call type", callType)}${row("Result", d.overallStatus)}${row("Scored by", d.scorer)}</table>` +
    `<h3 style="font-size:14px;margin:18px 0 4px">Areas to improve</h3>${areasHtml}` +
    `<h3 style="font-size:14px;margin:18px 0 4px">Coaching notes</h3>` +
    `<div style="background:#f6f7f9;border-radius:8px;padding:12px 14px;white-space:pre-wrap">${esc(d.coachingText)}</div>` +
    `<p style="margin-top:16px"><a href="${esc(d.appUrl)}">Review the full scorecard on the site →</a></p>` +
    `<p style="color:#888;font-size:12px;margin-top:16px">Sent by ${esc(d.senderName)} — CC-Quality</p>` +
    `</div></div>`;

  return { subject: `Coaching note — your call on ${date}`, text, html };
}

export type CoachingOutcome = { ok: true } | { ok: false; error: string };

/**
 * Send the coaching email for `evalId` and stamp it as coached. Guards: current
 * version, failed call, not already coached, agent has a linked email. The
 * caller must have already authorized `coaching.send`.
 */
export async function sendCoachingEmail(
  evalId: string,
  senderUserId: number,
  coachingText: string,
): Promise<CoachingOutcome> {
  const text = coachingText.trim();
  if (!text) return { ok: false, error: "A coaching message is required." };

  const evaluation = await prisma.evaluation.findUnique({
    where: { evalId },
    include: {
      agent: { include: { user: { select: { email: true } } } },
      lines: {
        include: {
          errorReason: {
            include: { attribute: { include: { category: { include: { section: true } } } } },
          },
        },
      },
    },
  });
  if (!evaluation) return { ok: false, error: "Evaluation not found." };
  if (evaluation.supersededAt)
    return { ok: false, error: "This is not the current version of the call." };
  if (!evaluation.failedScorecard)
    return { ok: false, error: "Coaching emails are for failed calls only." };
  if (evaluation.coachingSentAt)
    return { ok: false, error: "A coaching email was already sent for this call." };

  const agentEmail = evaluation.agent.user?.email;
  if (!agentEmail)
    return { ok: false, error: "The agent has no linked account with an email address." };

  const sender = await prisma.user.findUnique({
    where: { id: senderUserId },
    select: { name: true },
  });

  // Group the flagged lines by section → its failing attributes/reasons.
  const bySection = new Map<string, CoachingSection>();
  for (const line of evaluation.lines) {
    const section = line.errorReason.attribute.category.section;
    const entry =
      bySection.get(section.code) ??
      (() => {
        const s: CoachingSection = { code: section.code, label: section.label, items: [] };
        bySection.set(section.code, s);
        return s;
      })();
    entry.items.push({
      attribute: line.errorReason.attribute.label,
      reason: line.errorReason.label,
    });
  }

  const {
    subject,
    text: body,
    html,
  } = buildCoachingEmail({
    agentName: evaluation.agent.agentName,
    senderName: sender?.name ?? "A supervisor",
    scorer: evaluation.qaOwner,
    callDate: evaluation.callDate,
    phoneMasked: evaluation.mobileMasked,
    callType: evaluation.callType,
    overallStatus: evaluation.overallStatus ?? "Fail",
    failedSections: [...bySection.values()],
    coachingText: text,
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
  });

  try {
    await sendMail({ to: agentEmail, cc: await getCoachingCc(), subject, text: body, html });
  } catch {
    return { ok: false, error: "The coaching email could not be sent. Please try again." };
  }

  // Stamp as coached only after a successful send (one per version).
  const stamped = await prisma.evaluation.updateMany({
    where: { evalId, coachingSentAt: null },
    data: { coachingSentAt: new Date(), coachingSentById: senderUserId, coachingText: text },
  });
  if (stamped.count === 0)
    return { ok: false, error: "A coaching email was already sent for this call." };

  return { ok: true };
}
