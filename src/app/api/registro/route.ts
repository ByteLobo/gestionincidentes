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

function categoriaPorTiempo(minutes: number): string {
  if (minutes < 60) return "Menos de 1 hora";
  if (minutes < 120) return "1 - 2 horas";
  if (minutes < 240) return "2 - 4 horas";
  return "Más de 4 horas";
}

function porcentajePorTiempo(minutes: number): { porcentaje: number; regla: string } {
  if (minutes < 60) return { porcentaje: 100, regla: "< 1 hora = 100%" };
  if (minutes < 120) return { porcentaje: 75, regla: "1 - 2 horas = 75%" };
  if (minutes < 240) return { porcentaje: 50, regla: "2 - 4 horas = 50%" };
  return { porcentaje: 25, regla: "> 4 horas = 25%" };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const requiredFields = [
    "tipoRegistro",
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

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL no configurado" }, { status: 500 });
  }

  const tipoRegistro = body.tipoRegistro === "SOPORTE" ? "SOPORTE" : "INCIDENTE";
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
  const categoria = categoriaPorTiempo(diffMinutes);
  const { porcentaje, regla } = porcentajePorTiempo(diffMinutes);
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
      categoria,
      porcentaje,
      regla_porcentaje,
      estado,
      created_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
    )`,
    [
      tipoRegistro,
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
      categoria,
      porcentaje,
      regla,
      status,
      createdAt,
    ]
  );

  return NextResponse.json({ ok: true });
}
