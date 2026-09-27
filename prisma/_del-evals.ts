import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch (e) {
  console.error("could not load .env:", (e as Error).message);
}

const prisma = new PrismaClient();

async function main() {
  const before = {
    evaluations: await prisma.evaluation.count(),
    lines: await prisma.evaluationLine.count(),
    notifications: await prisma.notification.count(),
    periods: await prisma.period.count(),
  };
  console.log("BEFORE:", JSON.stringify(before));

  // Delete every evaluation (cascades evaluation_lines + eval-linked notifications).
  const evals = await prisma.evaluation.deleteMany({});
  console.log(`deleted evaluations: ${evals.count}`);

  // ...and the periods they were bucketed into. Periods are find-or-open, so the
  // next scored call re-creates whichever month it belongs to.
  const periods = await prisma.period.deleteMany({});
  console.log(`deleted periods: ${periods.count}`);

  const after = {
    evaluations: await prisma.evaluation.count(),
    lines: await prisma.evaluationLine.count(),
    notifications: await prisma.notification.count(),
    periods: await prisma.period.count(),
  };
  console.log("AFTER:", JSON.stringify(after));

  // Confirm what was left untouched.
  console.log(
    "KEPT — agents:",
    await prisma.agent.count(),
    " users:",
    await prisma.user.count(),
    " configs:",
    await prisma.scorecardConfig.count(),
    " settings:",
    await prisma.setting.count(),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
