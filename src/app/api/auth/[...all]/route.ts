import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { addCorsHeaders } from "@/lib/cors";

const handler = toNextJsHandler(auth);

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response, origin);
}

export async function GET(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    const url = new URL(req.url);
    
    // Log callback requests for debugging
    if (url.pathname?.includes('/callback/')) {
      console.log('OAuth callback received:', {
        path: url.pathname,
        provider: url.pathname.split('/callback/')[1],
        hasCode: url.searchParams.has('code'),
        hasState: url.searchParams.has('state'),
      });
    }
    
    const response = await handler.GET(req);
    return addCorsHeaders(response, origin);
  } catch (error: any) {
    console.error("Better-Auth GET error:", error);
    console.error("Error stack:", error?.stack);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      url: req.url,
    });
    
    // For OAuth callbacks, try to redirect to error page instead of JSON
    const url = new URL(req.url);
    if (url.pathname?.includes('/callback/')) {
      const errorPage = new URL("/", url.origin);
      errorPage.searchParams.set("error", error?.code || "oauth_error");
      errorPage.searchParams.set("error_description", error?.message || "Authentication failed");
      const redirectResponse = NextResponse.redirect(errorPage, 302);
      return addCorsHeaders(redirectResponse, req.headers.get("origin"));
    }
    
    const response = NextResponse.json(
      { error: "Authentication error", message: error?.message || "Unknown error" },
      { status: 500 }
    );
    return addCorsHeaders(response, req.headers.get("origin"));
  }
}

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    const response = await handler.POST(req);
    return addCorsHeaders(response, origin);
  } catch (error: any) {
    console.error("Better-Auth POST error:", error);
    const response = NextResponse.json(
      { error: "Authentication error", message: error?.message || "Unknown error" },
      { status: 500 }
    );
    return addCorsHeaders(response, req.headers.get("origin"));
  }
}
