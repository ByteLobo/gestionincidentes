import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  resolvePreviousReportDateRange,
  validateReportDateRange,
} from "@/lib/report-date-range";
import { getResolvedTicketsReport } from "@/lib/reportes";
import { getActorName, hasAnyRole, requireRoles } from "@/lib/security";

export const runtime = "nodejs";

function runPythonExport(inputPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "reporting", "export_kpi_report.py");
    const pythonBinary = process.env.KPI_REPORT_PYTHON || "python3";
    const child = spawn(pythonBinary, [scriptPath, inputPath, outputPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `El generador Python terminó con código ${code}`));
    });
  });
}

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
  const historyStart = `${fechaHasta.slice(0, 4)}-01-01`;
  const [report, previousReport, historyReport] = await Promise.all([
    getResolvedTicketsReport(auth, fechaDesde, fechaHasta),
    getResolvedTicketsReport(auth, previousRange.fechaDesde, previousRange.fechaHasta),
    getResolvedTicketsReport(auth, historyStart, fechaHasta),
  ]);
  const supportUsers = hasAnyRole(auth, ["SUPERVISOR", "ADMIN"])
    ? (
        await db.query(
          `SELECT DISTINCT COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS name
           FROM users u
           LEFT JOIN user_roles ur ON ur.user_id = u.id
           WHERE u.active = true
             AND (u.role = 'SOPORTE' OR ur.role = 'SOPORTE')
           ORDER BY name ASC`
        )
      ).rows.map((row: { name: string }) => row.name)
    : [getActorName(auth)];
  const tempBase = path.join(os.tmpdir(), `kpi-report-${randomUUID()}`);
  const inputPath = `${tempBase}.json`;
  const outputPath = `${tempBase}.xlsx`;

  try {
    await writeFile(
      inputPath,
      JSON.stringify({
        meta: report.meta,
        items: report.items,
        comparison: {
          meta: previousReport.meta,
          items: previousReport.items,
        },
        history: {
          meta: historyReport.meta,
          items: historyReport.items,
        },
        supportUsers,
      }),
      "utf8"
    );

    await runPythonExport(inputPath, outputPath);

    const fileBuffer = await readFile(outputPath);
    const filename = `reporte_kpi_${fechaDesde}_a_${fechaHasta}.xlsx`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el reporte KPI";
    const details = message.includes("No module named 'xlsxwriter'")
      ? `${message}. Instala dependencias con: pip install -r scripts/reporting/requirements.txt`
      : message;
    return NextResponse.json({ error: details }, { status: 500 });
  } finally {
    await Promise.allSettled([rm(inputPath, { force: true }), rm(outputPath, { force: true })]);
  }
}
