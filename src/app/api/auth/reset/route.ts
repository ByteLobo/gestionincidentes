import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { hashPasswordResetToken } from "@/lib/password-reset";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = body?.token?.trim();
  const password = body?.password ?? body?.newPassword;

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "La nueva contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  const tokenHash = hashPasswordResetToken(token);
  const reset = await db.query(
    "SELECT id, user_id, expires_at, used FROM password_resets WHERE token = $1",
    [tokenHash]
  );

  if (reset.rowCount === 0) {
    return NextResponse.json({ error: "Token inválido o expirado" }, { status: 400 });
  }

  const row = reset.rows[0];
  if (row.used || new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Token inválido o expirado" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, row.user_id]);
  await db.query("UPDATE password_resets SET used = true WHERE user_id = $1", [row.user_id]);

  return NextResponse.json({ ok: true });
}
