import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Next 16: middleware is now `proxy` (Node.js runtime). Cheap optimistic gate
// only — it checks for the presence of a session cookie and bounces obvious
// unauthenticated access. Real authorization (membership, roles) is enforced
// server-side in the org layout and in tRPC procedures.

const PUBLIC_PATHS = new Set(["/", "/sign-in", "/sign-up"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow API routes (auth handler, tRPC, webhooks) and public pages.
  if (pathname.startsWith("/api") || PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Everything else (/[orgSlug]/*, /onboarding, /post-auth) needs a session.
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const url = new URL("/sign-in", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
