import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { newRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";
import { buildCallbackPath, sanitizeCallbackUrl } from "@/lib/callback-url";

const patronOnlyRoutes = ["/create-mission"];
const signedRoutes = ["/home", "/mission", "/my-missions", "/profile", "/ranking"];
const guestOnlyRoutes = ["/login", "/register"];
const securityHeaders = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export default async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? newRequestId();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  const withRequestId = (response: NextResponse) => {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  };

  const isAdminRoute = pathname.startsWith("/admin");
  const needsPatron = patronOnlyRoutes.some((route) => pathname.startsWith(route));
  const needsSigned = signedRoutes.some((route) => pathname.startsWith(route));
  const guestOnly = guestOnlyRoutes.some((route) => pathname.startsWith(route));

  if ((isAdminRoute || needsPatron || needsSigned) && !token) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", buildCallbackPath(pathname, nextUrl.search));
    return withRequestId(NextResponse.redirect(loginUrl));
  }

  if (guestOnly && token) {
    const target = sanitizeCallbackUrl(nextUrl.searchParams.get("callbackUrl"), "/home");
    return withRequestId(NextResponse.redirect(new URL(target, nextUrl.origin)));
  }

  if (isAdminRoute && token?.role !== "ADMIN") {
    return withRequestId(NextResponse.redirect(new URL("/home", nextUrl.origin)));
  }

  if (needsPatron && token?.role !== "PATRON") {
    return withRequestId(NextResponse.redirect(new URL("/home", nextUrl.origin)));
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  return withRequestId(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
