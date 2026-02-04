import { NextRequest, NextResponse } from "next/server";

/**
 * Handle OPTIONS (preflight) for /api/auth/* so they always return 200 with CORS.
 * Fixes 405 on OPTIONS /api/auth/sign-out and OPTIONS /api/auth/sign-up/email
 * when the client sends a preflight before POST.
 */
const CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS, PATCH";
const CORS_HEADERS = "Content-Type, Authorization, Cookie, X-Requested-With, Accept, Origin, User-Agent";

function allowOrigin(origin: string | null): string {
  if (!origin) return "http://localhost:3001";
  // Allow common dev and production origins + app:// and exp:// (desktop/Expo)
  const ok =
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin.startsWith("https://clipsync") ||
    origin.startsWith("http://192.168.") ||
    origin.startsWith("app://") ||
    origin.startsWith("exp://");
  return ok ? origin : "http://localhost:3001";
}

export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS" && request.nextUrl.pathname.startsWith("/api/auth")) {
    const origin = request.headers.get("origin");
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": allowOrigin(origin),
        "Access-Control-Allow-Methods": CORS_METHODS,
        "Access-Control-Allow-Headers": CORS_HEADERS,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/auth/:path*",
};
