import { NextRequest, NextResponse } from "next/server";

/**
 * Handle CORS preflight (OPTIONS) for /api/auth/* before any route runs.
 * Fixes 405 on OPTIONS when server is in cloud (Railway).
 * See: https://github.com/better-auth/better-auth/issues/4052
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // OPTIONS = CORS preflight: respond immediately with 204 + CORS headers
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin");
    const requestedMethod = request.headers.get("access-control-request-method");
    const requestedHeaders = request.headers.get("access-control-request-headers");
    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", origin || "*");
    headers.set("Access-Control-Allow-Methods", requestedMethod || "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    headers.set("Access-Control-Allow-Headers", requestedHeaders || "Content-Type, Authorization, Cookie, X-Requested-With, Accept, Origin");
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Max-Age", "86400");
    return new NextResponse(null, { status: 204, headers });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/:path*"],
};
