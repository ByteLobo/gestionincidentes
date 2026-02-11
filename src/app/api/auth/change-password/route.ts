import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authCookieName, verifyJwt } from "@/lib/auth";

export async function POST(req: Request) {
  const jar = await cookies();
  const token = jar.get(authCookieName)?.value;
  const payload = token ? verifyJwt(token) : null;
  if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const user = await db.query("SELECT id, password_hash FROM users WHERE id = $1", [payload.sub]);
  if (user.rowCount === 0) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const ok = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
  if (!ok) return NextResponse.json({ error: "Contraseña actual inválida" }, { status: 400 });

  const hash = await bcrypt.hash(newPassword, 12);
  await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, payload.sub]);

  return NextResponse.json({ ok: true });
}
