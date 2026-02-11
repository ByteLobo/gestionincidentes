import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authCookieName, verifyJwt } from "./src/lib/auth";

const PROTECTED_PREFIXES = ["/incidentes", "/soporte", "/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(authCookieName)?.value;
  const payload = token ? verifyJwt(token) : null;
  if (!token || !payload) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin")) {
    const roles = payload.roles && payload.roles.length ? payload.roles : payload.role ? [payload.role] : [];
    const allow = (allowed: string[]) => allowed.some((r) => roles.includes(r));
    if (pathname.startsWith("/admin/catalogos") || pathname.startsWith("/admin/usuarios")) {
      if (!allow(["ADMIN"])) return NextResponse.redirect(new URL("/no-autorizado", req.url));
    } else if (pathname.startsWith("/admin/resueltos")) {
      if (!allow(["SUPERVISOR", "ADMIN"])) {
        return NextResponse.redirect(new URL("/no-autorizado", req.url));
      }
    } else if (pathname.startsWith("/admin/graficos")) {
      if (!allow(["SOPORTE", "SUPERVISOR", "ADMIN"])) {
        return NextResponse.redirect(new URL("/no-autorizado", req.url));
      }
    } else if (pathname.startsWith("/admin/mis-tickets")) {
      if (!allow(["SOPORTE", "SUPERVISOR", "ADMIN"])) {
        return NextResponse.redirect(new URL("/no-autorizado", req.url));
      }
    } else if (pathname.startsWith("/admin/en-proceso")) {
      if (!allow(["SOPORTE", "SUPERVISOR", "ADMIN"])) {
        return NextResponse.redirect(new URL("/no-autorizado", req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/incidentes/:path*", "/soporte/:path*", "/admin/:path*"],
};
