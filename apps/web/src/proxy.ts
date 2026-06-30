import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next 16: middleware is now `proxy` (Node.js runtime). This is a thin gate —
// it does a cheap session-cookie presence check and redirects unauthenticated
// users away from app routes. Full auth/role checks happen in tRPC procedures.
//
// BetterAuth's session cookie name is wired in M2; until then this is a no-op
// pass-through so the app boots.

const SESSION_COOKIE = "better-auth.session_token";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // App (tenant) routes live under /app/*; protect them once auth is wired.
  const isProtected = pathname.startsWith("/app");
  if (!isProtected) return NextResponse.next();

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    // M2 will enable this redirect; left here so the gate is in place.
    // const url = new URL("/sign-in", request.url);
    // return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on app routes; skip api, static assets, and metadata files.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
