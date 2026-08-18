import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_ENABLED = false;

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("devion.session")?.value;
  const path = request.nextUrl.pathname;

  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/verify-email") ||
    path.startsWith("/accept-invite");

  // Auth während der Entwicklung deaktiviert
  if (AUTH_ENABLED) {
    if (!sessionCookie && !isAuthRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (path.startsWith("/admin")) {
      const isPlatformAdmin = false;

      if (!isPlatformAdmin) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
