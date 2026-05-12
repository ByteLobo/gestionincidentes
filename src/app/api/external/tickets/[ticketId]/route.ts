import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapExternalStatus } from "@/lib/external-status";

function isAuthorized(req: Request): boolean {
  const apiKey = req.headers.get("x-api-key") || "";
  const expected = process.env.EXTERNAL_API_KEY || "";
  return Boolean(expected) && apiKey === expected;
}

export async function GET(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { ticketId } = await params;
  const normalizedTicketId = ticketId.trim();
  if (!normalizedTicketId) {
    return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
  }

  const numericTicketId = /^\d+$/.test(normalizedTicketId) ? Number(normalizedTicketId) : null;

  const result = await db.query(
    `SELECT id, external_id, tipo_registro, solicitante, tipo_servicio, canal_oficina, gerencia,
            motivo_servicio, descripcion, encargado, fecha_reporte, hora_reporte,
            fecha_respuesta, hora_respuesta, accion_tomada, primer_contacto,
            tiempo_minutos, mes_atencion, categoria, porcentaje, regla_porcentaje,
            estado, clasificacion, created_at, last_updated_at
     FROM incidents
     WHERE external_id = $1 OR ($2::int IS NOT NULL AND id = $2)
     LIMIT 1`,
    [normalizedTicketId, numericTicketId]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "ticketId no encontrado" }, { status: 404 });
  }

  const item = result.rows[0];
  return NextResponse.json({
    ok: true,
    ticket: {
      ticketId: item.external_id,
      internalId: item.id,
      status: item.estado,
      statusCode: mapExternalStatus(item.estado),
      tipoRegistro: item.tipo_registro,
      solicitante: item.solicitante,
      tipoServicio: item.tipo_servicio,
      canalOficina: item.canal_oficina,
      gerencia: item.gerencia,
      motivoServicio: item.motivo_servicio,
      descripcion: item.descripcion,
      encargado: item.encargado,
      fechaReporte: item.fecha_reporte,
      horaReporte: item.hora_reporte,
      fechaRespuesta: item.fecha_respuesta,
      horaRespuesta: item.hora_respuesta,
      accionTomada: item.accion_tomada,
      primerContacto: item.primer_contacto,
      tiempoMinutos: item.tiempo_minutos,
      mesAtencion: item.mes_atencion,
      categoria: item.categoria,
      porcentaje: item.porcentaje,
      reglaPorcentaje: item.regla_porcentaje,
      clasificacion: item.clasificacion,
      createdAt: item.created_at,
      lastUpdatedAt: item.last_updated_at,
    },
  });
}
