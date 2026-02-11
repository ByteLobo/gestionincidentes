import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { authCookieName, verifyJwt } from "@/lib/auth";

async function getEncargadoScope() {
  const jar = await cookies();
  const token = jar.get(authCookieName)?.value;
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload) return null;
  const roles = payload.roles && payload.roles.length ? payload.roles : payload.role ? [payload.role] : [];
  if (roles.includes("SUPERVISOR") || roles.includes("ADMIN")) return null;
  if (roles.includes("SOPORTE")) {
    const user = await db.query("SELECT full_name FROM users WHERE id = $1", [payload.sub]);
    return user.rowCount ? user.rows[0].full_name : null;
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes");

  const values: string[] = [];
  let whereSql = "";
  if (mes) {
    values.push(mes);
    whereSql = "WHERE mes_atencion = $1";
  }

  const encargado = await getEncargadoScope();
  if (encargado) {
    values.push(encargado);
    whereSql = whereSql
      ? `${whereSql} AND encargado = $${values.length}`
      : `WHERE encargado = $${values.length}`;
  }

  const result = await db.query(
    `SELECT tipo_servicio, COUNT(*)::int AS total
     FROM incidents
     ${whereSql}
     GROUP BY tipo_servicio
     ORDER BY total DESC`,
    values
  );

  return NextResponse.json({ items: result.rows });
}
