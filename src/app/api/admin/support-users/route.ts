import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authCookieName, verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireSupportRoles() {
  const jar = await cookies();
  const token = jar.get(authCookieName)?.value;
  const payload = token ? verifyJwt(token) : null;
  const roles = payload?.roles && payload.roles.length ? payload.roles : payload?.role ? [payload.role] : [];
  if (!payload) return null;
  if (!roles.includes("SOPORTE") && !roles.includes("SUPERVISOR") && !roles.includes("ADMIN")) return null;
  return payload;
}

export async function GET() {
  const auth = await requireSupportRoles();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const result = await db.query(
    `SELECT id, full_name, username
     FROM users
     WHERE active = true AND role = 'SOPORTE'
     ORDER BY full_name ASC`
  );

  const items = result.rows.map((row) => ({
    id: row.id,
    name: row.full_name || row.username,
  }));

  return NextResponse.json({ items });
}
