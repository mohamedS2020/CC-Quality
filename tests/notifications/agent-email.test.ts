/**
 * @jest-environment node
 *
 * Agent emails go to the AGENT's email — with or without a login — and the site
 * link is included only for an agent who can sign in. Score, correction and
 * coaching emails all follow that rule; no email on file = nothing sent.
 */
import { prisma } from "@/lib/db/client";
import { baselineConfigInput } from "@/lib/config/baseline";
import { createConfigVersion } from "@/lib/config/versioning";
import { sendCoachingEmail } from "@/lib/coaching/coaching";
import { sendMail, type Mail } from "@/lib/email/mailer";
import {
  buildCorrectionEmail,
  buildScoreEmail,
  emailCorrectionPosted,
  emailScorePosted,
} from "@/lib/notifications/service";

jest.mock("@/lib/email/mailer", () => ({ sendMail: jest.fn() }));
const sent = sendMail as jest.MockedFunction<typeof sendMail>;
const last = (): Mail => sent.mock.calls.at(-1)![0];

const TAG = "@agentnotify.test";
const NO_LOGIN = 870001; // email, no account
const WITH_LOGIN = 870002; // email + active account
const NO_EMAIL = 870003; // neither
const CALL = new Date("2026-03-04T00:00:00Z");

let configId: number;
let senderId: number;

async function cleanup() {
  await prisma.evaluation.deleteMany({ where: { agentLoginId: { gte: 870000, lt: 870100 } } });
  await prisma.user.deleteMany({ where: { email: { contains: TAG } } });
  await prisma.agent.deleteMany({ where: { loginId: { gte: 870000, lt: 870100 } } });
}

beforeAll(async () => {
  process.env.APP_URL = "https://qa.example.com";
  await cleanup();
  const base = { tlName: "TL", joinDate: new Date("2025-01-01") };
  await prisma.agent.createMany({
    data: [
      { ...base, loginId: NO_LOGIN, agentName: "No Login", email: `nologin${TAG}` },
      { ...base, loginId: WITH_LOGIN, agentName: "With Login", email: `withlogin${TAG}` },
      { ...base, loginId: NO_EMAIL, agentName: "No Email" },
    ],
  });
  await prisma.user.create({
    data: {
      email: `withlogin${TAG}`,
      passwordHash: "x",
      name: "With Login",
      role: "AGENT",
      agentLoginId: WITH_LOGIN,
    },
  });
  senderId = (
    await prisma.user.create({
      data: { email: `coach${TAG}`, passwordHash: "x", name: "Coach", role: "ADMIN" },
    })
  ).id;
  configId = (await createConfigVersion(baselineConfigInput)).id;
});

beforeEach(() => sent.mockReset());

afterAll(async () => {
  await cleanup();
  await prisma.scorecardConfig.deleteMany({ where: { id: configId } });
  await prisma.$disconnect();
});

describe("agent emails", () => {
  it("emails an agent with no login, without the site link", async () => {
    await emailScorePosted(NO_LOGIN, CALL);
    expect(sent).toHaveBeenCalledTimes(1);
    expect(last().to).toBe(`nologin${TAG}`);
    expect(last().text).toContain("2026-03-04");
    expect(last().text).not.toContain("https://qa.example.com");
  });

  it("includes the site link for an agent who can sign in", async () => {
    await emailScorePosted(WITH_LOGIN, CALL);
    expect(last().to).toBe(`withlogin${TAG}`);
    expect(last().html).toContain('href="https://qa.example.com"');
  });

  it("sends a correction email with the new result", async () => {
    await emailCorrectionPosted(NO_LOGIN, CALL, "Pass");
    expect(last().to).toBe(`nologin${TAG}`);
    expect(last().subject).toBe("A scored call was corrected");
    expect(last().text).toContain("is now Pass");
  });

  it("sends nothing when the agent has no email", async () => {
    await emailScorePosted(NO_EMAIL, CALL);
    await emailCorrectionPosted(NO_EMAIL, CALL, "Fail");
    expect(sent).not.toHaveBeenCalled();
  });

  it("never lets a mail failure escape (best-effort)", async () => {
    sent.mockRejectedValueOnce(new Error("SMTP down"));
    await expect(emailScorePosted(NO_LOGIN, CALL)).resolves.toBeUndefined();
  });
});

describe("coaching email", () => {
  const failedCall = (agentLoginId: number) =>
    prisma.evaluation.create({
      data: {
        agentLoginId,
        configId,
        qaOwner: "qa",
        callDate: CALL,
        failedScorecard: true,
        overallStatus: "Fail",
      },
    });

  it("reaches an agent without a login, with no site link", async () => {
    const ev = await failedCall(NO_LOGIN);
    const res = await sendCoachingEmail(ev.evalId, senderId, "Verify the caller first.");
    expect(res).toEqual({ ok: true });
    expect(last().to).toBe(`nologin${TAG}`);
    expect(last().text).toContain("Verify the caller first.");
    expect(last().html).not.toContain("href=");
  });

  it("says what to do when the agent has no email", async () => {
    const ev = await failedCall(NO_EMAIL);
    const res = await sendCoachingEmail(ev.evalId, senderId, "note");
    expect(res).toEqual({ ok: false, error: expect.stringContaining("no email address") });
    expect(sent).not.toHaveBeenCalled();
  });
});

describe("email builders", () => {
  it("leave the link out when there is none, and escape names", () => {
    const noLink = buildScoreEmail("<b>x</b>", CALL, null);
    expect(noLink.html).not.toContain("href=");
    expect(noLink.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(buildCorrectionEmail("Ann", CALL, null, null).text).toContain("was corrected");
  });
});
