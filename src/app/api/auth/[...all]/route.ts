import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { addCorsHeaders } from "@/lib/cors";

const handler = toNextJsHandler(auth);

// Export route config to ensure OPTIONS is handled
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  
  // Handle CORS preflight for all auth endpoints
  // Better-auth might not handle OPTIONS, so we handle it here
  const response = new NextResponse(null, { status: 200 });
  
  // Add CORS headers - allow all origins
  const corsResponse = addCorsHeaders(response, origin);
  
  // Log for debugging
  console.log("OPTIONS preflight:", {
    path: url.pathname,
    origin: origin || "none",
    method: req.headers.get("access-control-request-method"),
  });
  
  return corsResponse;
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  const isCallback = url.pathname?.includes('/callback/');
  
  // Log callback requests for debugging
  if (isCallback) {
    console.log('OAuth callback received:', {
      path: url.pathname,
      provider: url.pathname?.split('/callback/')[1] || 'unknown',
      hasCode: url.searchParams.has('code'),
      hasState: url.searchParams.has('state'),
    });
  }
  
  try {
    // Wrap handler call to catch Better-auth internal errors
    const response = await handler.GET(req);
    
    // Check if response is valid
    if (!response) {
      throw new Error("Handler returned null response");
    }
    
    return addCorsHeaders(response, origin);
  } catch (error: any) {
    console.error("Better-Auth GET error:", error);
    console.error("Error type:", typeof error);
    console.error("Error constructor:", error?.constructor?.name);
    console.error("Error stack:", error?.stack);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      url: req.url,
      // Check if error has the problematic property
      errorString: String(error),
    });
    
    // Check for the specific "includes" error
    const isIncludesError = error?.message?.includes('includes is not a function') || 
                           error?.stack?.includes('includes is not a function') ||
                           String(error).includes('includes is not a function');
    
    if (isIncludesError || isCallback) {
      // For OAuth callbacks or includes errors, redirect to error page
      const errorPage = new URL("/", url.origin);
      errorPage.searchParams.set("error", error?.code || "oauth_error");
      errorPage.searchParams.set("error_description", 
        isIncludesError 
          ? "OAuth processing error. Please try again." 
          : (error?.message || "Authentication failed"));
      const redirectResponse = NextResponse.redirect(errorPage, 302);
      return addCorsHeaders(redirectResponse, origin);
    }
    
    const response = NextResponse.json(
      { error: "Authentication error", message: error?.message || "Unknown error" },
      { status: 500 }
    );
    return addCorsHeaders(response, origin);
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  
  try {
    const response = await handler.POST(req);
    
    // Check if response is valid
    if (!response) {
      throw new Error("Handler returned null response");
    }
    
    return addCorsHeaders(response, origin);
  } catch (error: any) {
    console.error("Better-Auth POST error:", error);
    console.error("Error type:", typeof error);
    console.error("Error stack:", error?.stack);
    
    // Check for the specific "includes" error
    const isIncludesError = error?.message?.includes('includes is not a function') || 
                           error?.stack?.includes('includes is not a function') ||
                           String(error).includes('includes is not a function');
    
    const response = NextResponse.json(
      { 
        error: "Authentication error", 
        message: isIncludesError 
          ? "OAuth processing error. Please try again." 
          : (error?.message || "Unknown error") 
      },
      { status: 500 }
    );
    return addCorsHeaders(response, origin);
  }
}
