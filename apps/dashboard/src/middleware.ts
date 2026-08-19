import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
  // Compatibility with sessions issued by earlier Devion deployments.
  "devion.session",
];

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/accept-invite",
];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) =>
    Boolean(request.cookies.get(name)?.value)
  );
  const isPublicPath =
    path === "/" ||
    PUBLIC_PATHS.some(
      (publicPath) => path === publicPath || path.startsWith(`${publicPath}/`),
    );

  // This is intentionally only a coarse navigation guard. Authorization and
  // platform-admin checks remain enforced by the API, where a cookie value is
  // validated instead of merely checked for presence.
  if (!hasSessionCookie && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();

  if (hasSessionCookie || !isPublicPath) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
