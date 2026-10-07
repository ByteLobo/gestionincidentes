import { NextResponse } from "next/server";
import {
  resolvePreviousReportDateRange,
  validateReportDateRange,
} from "@/lib/report-date-range";
import { getResolvedTicketsReport } from "@/lib/reportes";
import { requireRoles } from "@/lib/security";

export async function GET(req: Request) {
  const auth = await requireRoles(["SOPORTE", "SUPERVISOR", "ADMIN"]);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const fechaDesde = searchParams.get("fechaDesde");
  const fechaHasta = searchParams.get("fechaHasta");
  const fechaDesdeAnterior = searchParams.get("fechaDesdeAnterior");
  const fechaHastaAnterior = searchParams.get("fechaHastaAnterior");

  if (!fechaDesde || !fechaHasta) {
    return NextResponse.json({ error: "Debes indicar fechaDesde y fechaHasta" }, { status: 400 });
  }

  const currentRange = { fechaDesde, fechaHasta };
  const currentRangeError = validateReportDateRange(currentRange);
  if (currentRangeError) {
    return NextResponse.json({ error: currentRangeError }, { status: 400 });
  }

  const previousRangeResult = resolvePreviousReportDateRange(
    currentRange,
    fechaDesdeAnterior,
    fechaHastaAnterior
  );
  if (previousRangeResult.error || !previousRangeResult.range) {
    return NextResponse.json({ error: previousRangeResult.error }, { status: 400 });
  }

  const previousRange = previousRangeResult.range;
  const [report, previousReport] = await Promise.all([
    getResolvedTicketsReport(auth, fechaDesde, fechaHasta),
    getResolvedTicketsReport(auth, previousRange.fechaDesde, previousRange.fechaHasta),
  ]);
  return NextResponse.json({
    ...report,
    comparison: {
      current: report,
      previous: previousReport,
    },
  });
}
