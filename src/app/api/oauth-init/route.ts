import { NextRequest, NextResponse } from "next/server";
import { addCorsHeaders } from "@/lib/cors";
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Use the same handler as the auth route
const authHandler = toNextJsHandler(auth);

/**
 * Proxies form POST to /api/auth/sign-in/social, then returns 302 + forwards
 * Set-Cookie so the OAuth state is stored in the user's browser. This fixes
 * state_mismatch when the client app runs on a different origin (e.g. localhost)
 * than the auth service (e.g. Railway).
 * 
 * Instead of making an HTTP fetch, we call the auth handler directly since
 * we're on the same server.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const baseOrigin = (() => {
    try {
      return new URL(req.url).origin;
    } catch {
      return process.env.BETTER_AUTH_BASE_URL || 
             process.env.AUTH_SERVICE_URL || 
             "http://localhost:3001";
    }
  })();

  try {
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string>;
    if (contentType.includes("application/json")) {
      body = (await req.json()) as Record<string, string>;
    } else {
      const form = await req.formData();
      body = {
        provider: (form.get("provider") as string) || "github",
        callbackURL: (form.get("callbackURL") as string) || "/",
      };
      const err = form.get("errorCallbackURL");
      if (err) body.errorCallbackURL = err as string;
    }
    const provider = body.provider || "github";
    const callbackURL = body.callbackURL || "/";
    const errorCallbackURL = body.errorCallbackURL;

    // Create a new request to the auth endpoint
    const authUrl = new URL("/api/auth/sign-in/social", baseOrigin);
    const authRequest = new NextRequest(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": req.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        provider,
        callbackURL,
        ...(errorCallbackURL && { errorCallbackURL }),
      }),
    });

    // Call the auth handler directly instead of making HTTP fetch
    const authResponse = await authHandler.POST(authRequest);
    
    // Check if response is valid
    if (!authResponse) {
      throw new Error("Auth handler returned null response");
    }

    // Parse the JSON response from Better-auth
    let data: { url?: string; error?: string };
    try {
      data = await authResponse.json();
    } catch (parseError) {
      // If response is not JSON, it might be a redirect or error
      const responseText = await authResponse.text();
      console.error("Auth response was not JSON:", responseText.substring(0, 200));
      throw new Error("Auth service returned invalid response");
    }

    const redirectUrl = data?.url;
    if (!redirectUrl) {
      const err = data?.error || "No redirect URL from auth";
      const errorPage = new URL("/", baseOrigin);
      errorPage.searchParams.set("error", "oauth_init_failed");
      errorPage.searchParams.set("error_description", err);
      const r = NextResponse.redirect(errorPage, 302);
      return addCorsHeaders(r, origin);
    }

    const out = NextResponse.redirect(redirectUrl, 302);
    
    // Forward cookies from Better-auth response
    const setCookies: string[] =
      typeof (authResponse.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (authResponse.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
        : [];
    
    for (const cookie of setCookies) {
      // Parse and modify cookie to ensure it works cross-origin
      const cookieParts = cookie.split(';');
      const [nameValue] = cookieParts;
      
      let modifiedCookie = nameValue;
      
      if (!cookie.includes('SameSite=')) {
        modifiedCookie += '; SameSite=None';
      }
      if (!cookie.includes('Secure')) {
        modifiedCookie += '; Secure';
      }
      
      for (let i = 1; i < cookieParts.length; i++) {
        const part = cookieParts[i].trim();
        if (!part.startsWith('SameSite=') && !part.startsWith('Secure')) {
          modifiedCookie += `; ${part}`;
        }
      }
      
      out.headers.append("Set-Cookie", modifiedCookie);
    }
    
    return addCorsHeaders(out, origin);
  } catch (e) {
    console.error("oauth-init error:", e);
    console.error("Error details:", {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    
    const errorPage = new URL("/", baseOrigin);
    errorPage.searchParams.set("error", "oauth_init_failed");
    errorPage.searchParams.set(
      "error_description",
      e instanceof Error ? e.message : "Unknown error"
    );
    const r = NextResponse.redirect(errorPage, 302);
    return addCorsHeaders(r, origin);
  }
}
