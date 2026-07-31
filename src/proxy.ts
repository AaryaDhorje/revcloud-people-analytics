import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route guard.
 *
 * Next 16 renamed middleware to Proxy; the named export must be `proxy` and it
 * always runs on the Node runtime.
 *
 * This is deliberately an *optimistic* check, as the Next docs recommend: it
 * only looks for the presence of the non-secret session-hint cookie to decide
 * whether to render a dashboard route or bounce to the login page. It never
 * decides authorisation — every API call is independently authenticated and
 * RBAC-scoped on the backend, so a forged hint cookie buys nothing but an
 * empty page and a 401.
 */

const SESSION_HINT = "rc_session";

const PROTECTED_PREFIXES = ["/dashboard"];
// Signed-in users have no reason to see these again.
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.get(SESSION_HINT)?.value === "1";

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Preserve where they were heading so login can return them there.
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/dashboard",
    "/login",
    "/register",
    "/forgot-password",
  ],
};
