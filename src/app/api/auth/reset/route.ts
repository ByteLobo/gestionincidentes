import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = body?.token?.trim();
  const password = body?.password;
  const username = body?.username?.trim();
  const identifier = body?.identifier?.trim();

  if (!token && !identifier) {
    return NextResponse.json({ error: "Usuario o correo requerido" }, { status: 400 });
  }

  if (token) {
    const reset = await db.query(
      "SELECT id, user_id, expires_at, used FROM password_resets WHERE token = $1",
      [token]
    );

    if (reset.rowCount === 0) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }

    const row = reset.rows[0];
    if (row.used) {
      return NextResponse.json({ error: "Token ya utilizado" }, { status: 400 });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Token expirado" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);
    await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, row.user_id]);
    await db.query("UPDATE password_resets SET used = true WHERE id = $1", [row.id]);
  } else {
    const user = await db.query(
      "SELECT id, email FROM users WHERE (username = $1 OR email = $1) AND active = true",
      [identifier]
    );
    if (user.rowCount === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    const tempPassword = Math.random().toString(36).slice(-10);
    const hash = await bcrypt.hash(tempPassword, 12);
    await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, user.rows[0].id]);
    return NextResponse.json({
      ok: true,
      message: `Contraseña enviada al correo ${user.rows[0].email}. (Simulado)`,
      temp_password: tempPassword,
    });
  }

  return NextResponse.json({ ok: true });
}
