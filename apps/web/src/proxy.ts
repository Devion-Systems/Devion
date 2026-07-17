import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// TODO: Echten Session-Check gegen Better Auth ergänzen (Cookie lesen und validieren,
// z. B. über einen leichten /api/auth/session-Aufruf im Backend statt lokalem Decode).
export function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("devion.session")?.value;
  const path = request.nextUrl.pathname;

  // Public assets do not require a session and must never redirect to login.
  if (/\.(?:css|gif|ico|jpe?g|js|map|png|svg|ttf|webp|woff2?)$/i.test(path)) {
    return NextResponse.next();
  }

  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/verify-email") ||
    path.startsWith("/accept-invite");

  if (!sessionCookie && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (path.startsWith("/admin")) {
    // TODO: Rolle aus Session/JWT lesen statt Platzhalter-Check.
    const isPlatformAdmin = false;
    if (!isPlatformAdmin) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|devion-logo.png).*)"],
};
