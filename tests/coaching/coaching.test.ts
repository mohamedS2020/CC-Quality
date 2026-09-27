/**
 * Coaching email builder (documented action): the professional note carries the
 * call data, the failed sections with their failing attributes, the scorer, the
 * sender, and the coaching text. Pure — no DB/transport.
 */
import { buildCoachingEmail } from "@/lib/coaching/coaching";

const email = buildCoachingEmail({
  agentName: "Ann Ali",
  senderName: "Sam Supervisor",
  scorer: "qa.owner",
  callDate: new Date("2026-07-01T00:00:00Z"),
  phoneMasked: "******5658",
  callType: "Facility Request",
  overallStatus: "Fail",
  failedSections: [
    {
      code: "CC",
      label: "Critical Compliance",
      items: [{ attribute: "Security verification", reason: "Didn't make security verification" }],
    },
  ],
  coachingText: "Please verify identity before sharing any account data.",
  appUrl: "https://qa.example.com",
});

describe("buildCoachingEmail", () => {
  it("puts the call date in the subject", () => {
    expect(email.subject).toBe("Coaching note — your call on 2026-07-01");
  });

  it("includes the call data, scorer, failed section + attribute, and coaching text", () => {
    for (const needle of [
      "Ann Ali",
      "2026-07-01",
      "******5658",
      "Facility Request",
      "qa.owner",
      "CC — Critical Compliance",
      "Security verification",
      "Didn't make security verification",
      "Please verify identity before sharing any account data.",
      "Sam Supervisor",
    ]) {
      expect(email.text).toContain(needle);
    }
  });

  it("links to the site and escapes HTML", () => {
    expect(email.html).toContain('href="https://qa.example.com"');
    const evil = buildCoachingEmail({ ...baseFor("<b>x</b>") });
    expect(evil.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(evil.html).not.toContain("<b>x</b>");
  });
});

function baseFor(agentName: string) {
  return {
    agentName,
    senderName: "S",
    scorer: "q",
    callDate: new Date("2026-07-01T00:00:00Z"),
    phoneMasked: null,
    callType: null,
    overallStatus: "Fail",
    failedSections: [],
    coachingText: "note",
    appUrl: "https://x",
  };
}
