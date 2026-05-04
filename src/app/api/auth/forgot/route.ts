import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDuplicateMessage, isUniqueViolation } from "@/lib/pg-errors";
import {
  buildPasswordResetUrl,
  dispatchPasswordResetLink,
  generatePasswordResetToken,
  hashPasswordResetToken,
} from "@/lib/password-reset";

const GENERIC_RESPONSE = {
  ok: true,
  message: "Si la cuenta existe, se enviaron instrucciones para restablecer la contraseña.",
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const identifier = body?.identifier?.trim();

  if (!identifier) {
    return NextResponse.json({ error: "Usuario o correo requerido" }, { status: 400 });
  }

  const user = await db.query(
    "SELECT id, email FROM users WHERE (username = $1 OR email = $1) AND active = true",
    [identifier]
  );
  if (user.rowCount === 0) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  const token = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(token);
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  try {
    await db.query("UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false", [user.rows[0].id]);
    await db.query(
      "INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [user.rows[0].id, tokenHash, expires]
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: getDuplicateMessage(error, "No se pudo procesar la solicitud") }, { status: 409 });
    }
    throw error;
  }

  const resetUrl = buildPasswordResetUrl(req.url, token);
  await dispatchPasswordResetLink(user.rows[0].email, resetUrl);

  return NextResponse.json(GENERIC_RESPONSE);
}
