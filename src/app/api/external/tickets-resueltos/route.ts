import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function isAuthorized(req: Request): boolean {
  const apiKey = req.headers.get("x-api-key") || "";
  const expected = process.env.EXTERNAL_API_KEY || "";
  return Boolean(expected) && apiKey === expected;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes"); // YYYY-MM
  const fechaDesde = searchParams.get("desde"); // YYYY-MM-DD
  const fechaHasta = searchParams.get("hasta"); // YYYY-MM-DD

  const where: string[] = ["estado = 'RESUELTO'"];
  const values: Array<string> = [];

  if (mes) {
    values.push(mes);
    where.push(`mes_atencion = $${values.length}`);
  }
  if (fechaDesde) {
    values.push(fechaDesde);
    where.push(`fecha_reporte >= $${values.length}`);
  }
  if (fechaHasta) {
    values.push(fechaHasta);
    where.push(`fecha_reporte <= $${values.length}`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const result = await db.query(
    `SELECT id, tipo_registro, solicitante, tipo_servicio, canal_oficina, gerencia,
            motivo_servicio, descripcion, encargado, fecha_reporte, hora_reporte,
            fecha_respuesta, hora_respuesta, accion_tomada, primer_contacto,
            tiempo_minutos, mes_atencion, categoria, porcentaje, estado, created_at
     FROM incidents
     ${whereSql}
     ORDER BY created_at DESC`,
    values
  );

  return NextResponse.json({ items: result.rows });
}
