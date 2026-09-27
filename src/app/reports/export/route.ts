import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth";
import { AuthError } from "@/lib/auth/errors";
import { loadActiveConfig } from "@/lib/config/loader";
import { prisma } from "@/lib/db/client";
import { reportPeriods } from "@/lib/reports/filters";
import { loadReport, pickLens } from "@/lib/reports/metrics";
import { loadCallDetails } from "@/lib/reports/detail";
import { previousPeriodId, resolveScope, resolveWindow } from "@/lib/reports/resolve";
import { callRows, toCsv, toPdf, toXlsx } from "@/lib/reports/export";

export const dynamic = "force-dynamic";

const bodyOf = (buffer: Uint8Array) => buffer as unknown as BodyInit;

/** Download the current report as CSV / Excel / PDF, behind `reports.export` (FR-43). */
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
  const fmtParam = q.get("format");
  const format = fmtParam === "xlsx" || fmtParam === "pdf" ? fmtParam : "csv";
  const params = {
    scope: q.get("scope") ?? undefined,
    tl: q.get("tl") ?? undefined,
    agent: q.get("agent") ?? undefined,
    period: q.get("period") ?? undefined,
    lens: q.get("lens") ?? undefined,
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
  };

  const config = await loadActiveConfig();
  if (!config) return new Response("No active configuration.", { status: 400 });

  const periods = await reportPeriods();
  if (periods.length === 0) return new Response("No scored calls.", { status: 400 });

  const selected = periods.find((p) => p.label === params.period) ?? periods[0];
  // Same resolution as the page, so an export matches the report it came from.
  const { window, invalid } = resolveWindow(params, {
    periodId: selected.id,
    previousPeriodId: previousPeriodId(periods, selected.id),
    label: selected.label,
  });
  if (invalid) return new Response(invalid, { status: 400 });

  const lens = pickLens(config, params.lens);
  if (!lens) return new Response("No lenses configured.", { status: 400 });

  const sr = resolveScope(params, { role: ctx.user.role, agentLoginId: ctx.user.agentLoginId });
  if (!sr.ok) return new Response(sr.message, { status: 400 });

  const [report, details] = await Promise.all([
    loadReport(config, lens, sr.scope, window),
    loadCallDetails(config, sr.scope, window.current),
  ]);
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
  const meta = { scopeLabel, period: window.label, lensLabel: lens.label };
  const base =
    window.from && window.to ? `report-${window.from}_to_${window.to}` : `report-${selected.label}`;

  // Uint8Array cast bridges the TS 5.7 typed-array/BodyInit friction (valid at runtime).
  if (format === "xlsx") {
    const buffer = await toXlsx(report, details, sections, meta, config.roundingDecimals);
    return new Response(bodyOf(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer = await toPdf(report, details, sections, meta, config.roundingDecimals);
    return new Response(bodyOf(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${base}.pdf"`,
      },
    });
  }

  // CSV carries the full raw per-call data (one table).
  const csv = toCsv(callRows(details, sections, config.roundingDecimals));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.csv"`,
    },
  });
}
