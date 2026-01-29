import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

// Explicit CORS for Better-auth (fixes CORS when server is in cloud)
// See: https://github.com/better-auth/better-auth/issues/4052
const { GET: baseGet, POST: basePost } = toNextJsHandler(auth);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, X-Requested-With, Accept, Origin, User-Agent",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

function buildCorsResponse(origin: string | null, status: number, body: BodyInit | null = null): NextResponse {
  const headers = { ...corsHeaders };
  headers["Access-Control-Allow-Origin"] = origin || "*";
  return new NextResponse(body, { status, headers }) as NextResponse;
}

function applyCorsToResponse(res: Response, origin: string | null): NextResponse {
  const out = new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: new Headers(res.headers),
  });
  for (const [key, value] of Object.entries(corsHeaders)) {
    out.headers.set(key, value);
  }
  out.headers.set("Access-Control-Allow-Origin", origin || "*");
  return out;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  // Allow all origins: echo back origin for preflight
  return buildCorsResponse(origin, 204);
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  const isCallback = url.pathname?.includes("/callback/");

  if (isCallback) {
    console.log("OAuth callback received:", {
      path: url.pathname,
      provider: url.pathname?.split("/callback/")[1] || "unknown",
      hasCode: url.searchParams.has("code"),
      hasState: url.searchParams.has("state"),
    });
  }

  try {
    const res = await baseGet(req);
    if (!res) throw new Error("Handler returned null response");
    return applyCorsToResponse(res, origin);
  } catch (error: any) {
    console.error("Better-Auth GET error:", error?.message ?? error);
    const isIncludesError =
      error?.message?.includes("includes is not a function") ||
      error?.stack?.includes("includes is not a function") ||
      String(error).includes("includes is not a function");
    if (isIncludesError || isCallback) {
      const errorPage = new URL("/", url.origin);
      errorPage.searchParams.set("error", error?.code || "oauth_error");
      errorPage.searchParams.set(
        "error_description",
        isIncludesError ? "OAuth processing error. Please try again." : (error?.message || "Authentication failed")
      );
      const redirectResponse = NextResponse.redirect(errorPage, 302);
      return applyCorsToResponse(redirectResponse, origin);
    }
    const response = NextResponse.json(
      { error: "Authentication error", message: error?.message || "Unknown error" },
      { status: 500 }
    );
    return applyCorsToResponse(response, origin);
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const res = await basePost(req);
    if (!res) throw new Error("Handler returned null response");
    return applyCorsToResponse(res, origin);
  } catch (error: any) {
    console.error("Better-Auth POST error:", error?.message ?? error);
    const isOriginError =
      error?.code === "INVALID_ORIGIN" ||
      error?.code === "MISSING_OR_NULL_ORIGIN" ||
      error?.message?.includes("Invalid origin") ||
      error?.message?.includes("Missing or null Origin");
    if (isOriginError) {
      console.warn("Origin validation failed in Better-auth, CORS still allowing:", origin);
    }
    const isIncludesError =
      error?.message?.includes("includes is not a function") ||
      error?.stack?.includes("includes is not a function") ||
      String(error).includes("includes is not a function");
    const response = NextResponse.json(
      {
        error: "Authentication error",
        message: isIncludesError ? "OAuth processing error. Please try again." : (error?.message || "Unknown error"),
      },
      { status: isOriginError ? 403 : 500 }
    );
    return applyCorsToResponse(response, origin);
  }
}
