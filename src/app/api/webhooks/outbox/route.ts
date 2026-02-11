import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authCookieName, verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";
import { retryWebhookOutbox } from "@/lib/webhooks";

async function requireAdmin() {
  const jar = await cookies();
  const token = jar.get(authCookieName)?.value;
  const payload = token ? verifyJwt(token) : null;
  const roles = payload?.roles && payload.roles.length ? payload.roles : payload?.role ? [payload.role] : [];
  if (!payload || !roles.includes("ADMIN")) return null;
  return payload;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const result = await db.query(
    `SELECT id, event_type, status, attempts, last_error, created_at, updated_at
     FROM webhook_outbox
     ORDER BY created_at DESC
     LIMIT 100`
  );

  return NextResponse.json({ items: result.rows });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const id = body?.id ? Number(body.id) : undefined;

  if (body && "id" in body && (!id || Number.isNaN(id))) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const result = await retryWebhookOutbox(id);
  return NextResponse.json({ ok: true, ...result });
}
