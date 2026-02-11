import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function toDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function monthFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const requiredFields = [
    "solicitante",
    "tipoServicio",
    "canalOficina",
    "gerencia",
    "motivoServicio",
    "descripcion",
    "encargado",
    "fechaReporte",
    "horaReporte",
    "fechaRespuesta",
    "horaRespuesta",
    "accionTomada",
    "primerContacto",
  ];

  for (const field of requiredFields) {
    if (!body[field]) {
      return NextResponse.json({ error: `Campo requerido: ${field}` }, { status: 400 });
    }
  }

  const start = toDateTime(body.fechaReporte, body.horaReporte);
  const end = toDateTime(body.fechaRespuesta, body.horaRespuesta);
  if (!start || !end) {
    return NextResponse.json({ error: "Fecha/hora inválida" }, { status: 400 });
  }
  if (end.getTime() < start.getTime()) {
    return NextResponse.json({ error: "Respuesta anterior al reporte" }, { status: 400 });
  }

  const diffMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  const createdAt = new Date();
  const monthAttention = monthFromDate(createdAt);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL no configurado" }, { status: 500 });
  }

  const status = body.primerContacto === "SI" ? "RESUELTO" : "REGISTRADO";

  await db.query(
    `INSERT INTO incidents (
      tipo_registro,
      solicitante,
      tipo_servicio,
      canal_oficina,
      gerencia,
      motivo_servicio,
      descripcion,
      encargado,
      fecha_reporte,
      hora_reporte,
      fecha_respuesta,
      hora_respuesta,
      accion_tomada,
      primer_contacto,
      tiempo_minutos,
      mes_atencion,
      estado,
      created_at
    ) VALUES (
      'SOPORTE',
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
    )`,
    [
      body.solicitante,
      body.tipoServicio,
      body.canalOficina,
      body.gerencia,
      body.motivoServicio,
      body.descripcion,
      body.encargado,
      body.fechaReporte,
      body.horaReporte,
      body.fechaRespuesta,
      body.horaRespuesta,
      body.accionTomada,
      body.primerContacto === "SI",
      diffMinutes,
      monthAttention,
      status,
      createdAt,
    ]
  );

  return NextResponse.json({ ok: true });
}
