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
    // Include Origin header - Better-auth requires it for security
    const authUrl = new URL("/api/auth/sign-in/social", baseOrigin);
    const authRequest = new NextRequest(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": req.headers.get("cookie") || "",
        "Origin": baseOrigin, // Better-auth requires Origin header - use auth service origin
        "Referer": baseOrigin, // Use auth service origin for internal call
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

    console.log("Auth handler response:", {
      status: authResponse.status,
      statusText: authResponse.statusText,
      contentType: authResponse.headers.get("content-type"),
      location: authResponse.headers.get("Location"),
    });

    // Better-auth might return either:
    // 1. A redirect response (302) with Location header
    // 2. A JSON response with { url: "...", error: "..." }
    let redirectUrl: string | null = null;
    
    // Check if it's a redirect response
    if (authResponse.status >= 300 && authResponse.status < 400) {
      redirectUrl = authResponse.headers.get("Location");
      if (redirectUrl) {
        console.log("Auth handler returned redirect:", redirectUrl);
      } else {
        console.warn("Redirect response but no Location header");
      }
    } else if (authResponse.status === 200) {
      // Try to parse as JSON
      try {
        const contentType = authResponse.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          // Clone response before reading body (in case we need to read it again)
          const clonedResponse = authResponse.clone();
          const data = await clonedResponse.json() as { url?: string; error?: string };
          console.log("Auth handler returned JSON:", data);
          redirectUrl = data?.url || null;
          
          if (!redirectUrl && data?.error) {
            throw new Error(data.error);
          }
        } else {
          // Not JSON, might be HTML or text
          const clonedResponse = authResponse.clone();
          const responseText = await clonedResponse.text();
          console.error("Auth response was not JSON or redirect:", {
            status: authResponse.status,
            contentType,
            preview: responseText.substring(0, 200),
          });
          throw new Error("Auth service returned unexpected response format");
        }
      } catch (parseError) {
        console.error("Failed to parse auth response:", parseError);
        throw new Error("Auth service returned invalid response");
      }
    } else {
      // Error status
      const clonedResponse = authResponse.clone();
      const responseText = await clonedResponse.text();
      console.error("Auth handler returned error:", {
        status: authResponse.status,
        statusText: authResponse.statusText,
        body: responseText.substring(0, 500),
      });
      throw new Error(`Auth service returned error: ${authResponse.status} ${authResponse.statusText}`);
    }

    if (!redirectUrl) {
      const err = "No redirect URL from auth";
      console.error("No redirect URL found in auth response");
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
