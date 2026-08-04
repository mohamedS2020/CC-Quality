import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth";
import { AuthError } from "@/lib/auth/errors";
import { loadActiveConfig } from "@/lib/config/loader";
import { prisma } from "@/lib/db/client";
import { reportPeriods } from "@/lib/reports/filters";
import { loadReport, pickLens } from "@/lib/reports/metrics";
import { previousPeriodId, resolveScope } from "@/lib/reports/resolve";
import { agentRows, toCsv, toXlsx } from "@/lib/reports/export";

export const dynamic = "force-dynamic";

/** Download the current report as CSV or Excel, behind `reports.export` (FR-43). */
export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await authorize("reports.export");
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(error.status === 401 ? "Not signed in." : "Forbidden.", {
        status: error.status,
      });
    }
    throw error;
  }

  const q = new URL(req.url).searchParams;
  const format = q.get("format") === "xlsx" ? "xlsx" : "csv";
  const params = {
    scope: q.get("scope") ?? undefined,
    tl: q.get("tl") ?? undefined,
    agent: q.get("agent") ?? undefined,
    period: q.get("period") ?? undefined,
    lens: q.get("lens") ?? undefined,
  };

  const config = await loadActiveConfig();
  if (!config) return new Response("No active configuration.", { status: 400 });

  const periods = await reportPeriods();
  if (periods.length === 0) return new Response("No scored calls.", { status: 400 });

  const selected = periods.find((p) => p.label === params.period) ?? periods[0];
  const prevId = previousPeriodId(periods, selected.id);

  const lens = pickLens(config, params.lens);
  if (!lens) return new Response("No lenses configured.", { status: 400 });

  const sr = resolveScope(params, { role: ctx.user.role, agentLoginId: ctx.user.agentLoginId });
  if (!sr.ok) return new Response(sr.message, { status: 400 });

  const report = await loadReport(config, lens, sr.scope, selected.id, prevId);
  const sections = config.sections.map((s) => ({ sectionId: s.id, code: s.code }));

  let scopeLabel = "Whole account";
  if (sr.kind === "tl") scopeLabel = `Team ${sr.tl}`;
  else if (sr.kind === "agent" && sr.agentLoginId != null) {
    const agent = await prisma.agent.findUnique({
      where: { loginId: sr.agentLoginId },
      select: { agentName: true },
    });
    scopeLabel = `Agent ${agent?.agentName ?? sr.agentLoginId}`;
  }
  const meta = { scopeLabel, period: selected.label, lensLabel: lens.label };
  const base = `report-${selected.label}`;

  if (format === "xlsx") {
    const buffer = await toXlsx(report, sections, meta, config.roundingDecimals);
    // Cast around the TS 5.7 typed-array/BodyInit friction; a Uint8Array is a
    // valid response body at runtime.
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      },
    });
  }

  const csv = toCsv(agentRows(report, sections, config.roundingDecimals));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.csv"`,
    },
  });
}
