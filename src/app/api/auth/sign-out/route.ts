/**
 * Explicit route for /api/auth/sign-out so OPTIONS preflight is handled.
 * Next.js catch-all [...all] does not receive OPTIONS; this route does.
 */
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { addCorsHeaders, corsPreflightResponse } from "@/lib/cors";

const { GET: baseGet, POST: basePost } = toNextJsHandler(auth);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  return corsPreflightResponse(origin);
}

function withCors(res: Response, origin: string | null): NextResponse {
  const nextRes = new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: new Headers(res.headers),
  });
  return addCorsHeaders(nextRes, origin);
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  try {
    const res = await baseGet(req);
    if (!res) return addCorsHeaders(new NextResponse(null, { status: 500 }), origin);
    return withCors(res, origin);
  } catch (e: unknown) {
    const err = e as { message?: string };
    const res = NextResponse.json(
      { error: "Authentication error", message: err?.message ?? "Unknown error" },
      { status: 500 }
    );
    return addCorsHeaders(res, origin);
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  try {
    const res = await basePost(req);
    if (!res) return addCorsHeaders(new NextResponse(null, { status: 500 }), origin);
    return withCors(res, origin);
  } catch (e: unknown) {
    const err = e as { message?: string };
    const res = NextResponse.json(
      { error: "Authentication error", message: err?.message ?? "Unknown error" },
      { status: 500 }
    );
    return addCorsHeaders(res, origin);
  }
}
