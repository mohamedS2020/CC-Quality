/**
 * Score-notification email (item 4): the pure content builder, and the mailer's
 * dev fallback (no SMTP configured → log, never throw, never send).
 */
import { buildScoreEmail } from "@/lib/notifications/service";
import { sendMail } from "@/lib/email/mailer";

describe("buildScoreEmail", () => {
  it("includes the call date, the app link, and the agent's name", () => {
    const email = buildScoreEmail(
      "Ann Ali",
      new Date("2026-07-01T00:00:00Z"),
      "https://qa.example.com",
    );
    expect(email.subject).toBe("A call was scored for you");
    expect(email.text).toContain("2026-07-01");
    expect(email.text).toContain("https://qa.example.com");
    expect(email.text).toContain("Ann Ali");
    expect(email.html).toContain('href="https://qa.example.com"');
  });

  it("escapes HTML in the agent name", () => {
    const email = buildScoreEmail("<b>x</b>", new Date("2026-07-01T00:00:00Z"), "https://x");
    expect(email.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(email.html).not.toContain("<b>x</b>");
  });
});

describe("sendMail dev fallback", () => {
  it("logs instead of sending when SMTP is not configured", async () => {
    delete process.env.SMTP_HOST;
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});
    await expect(
      sendMail({ to: "agent@example.com", subject: "Hi", text: "body" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("agent@example.com"));
    spy.mockRestore();
  });
});
