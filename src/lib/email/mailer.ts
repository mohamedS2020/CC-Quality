import "server-only";
import type { Transporter } from "nodemailer";

/**
 * SMTP mailer (nodemailer, item 4). Configured from env; with no `SMTP_HOST` set
 * it logs the message to the console instead of sending, so dev needs no mail
 * server. nodemailer is imported lazily so importing this module stays safe in
 * non-Node (test) environments. Callers treat sending as best-effort.
 */

export interface Mail {
  to: string;
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
}

// undefined = not initialised, null = no SMTP configured (dev/log mode).
let cached: Transporter | null | undefined;

async function getTransport(): Promise<Transporter | null> {
  if (cached !== undefined) return cached;
  const host = process.env.SMTP_HOST;
  if (!host) {
    cached = null;
    return null;
  }
  const nodemailer = (await import("nodemailer")).default;
  cached = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
      : undefined,
  });
  return cached;
}

export async function sendMail(mail: Mail): Promise<void> {
  const from = process.env.MAIL_FROM ?? "CC-Quality <no-reply@cc-quality.local>";
  const cc = mail.cc && mail.cc.length > 0 ? mail.cc : undefined;
  const transport = await getTransport();
  if (!transport) {
    // Dev fallback: nothing is sent, but the message is visible in the server log.
    const ccLine = cc ? ` · cc=${cc.join(", ")}` : "";
    console.info(`[email:dev] to=${mail.to}${ccLine} · subject="${mail.subject}"\n${mail.text}`);
    return;
  }
  await transport.sendMail({
    from,
    to: mail.to,
    cc,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}
