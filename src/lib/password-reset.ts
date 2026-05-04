import crypto from "crypto";

export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashPasswordResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function buildPasswordResetUrl(origin: string, token: string): string {
  const url = new URL("/recuperar", origin);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function dispatchPasswordResetLink(email: string, resetUrl: string) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[password-reset] ${email}: ${resetUrl}`);
  }

  // Placeholder for real delivery integration (SMTP/provider).
  return { delivered: true };
}
