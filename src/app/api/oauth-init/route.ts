import { NextRequest, NextResponse } from "next/server";
import { addCorsHeaders } from "@/lib/cors";

/**
 * Proxies form POST to /api/auth/sign-in/social, then returns 302 + forwards
 * Set-Cookie so the OAuth state is stored in the user's browser. This fixes
 * state_mismatch when the client app runs on a different origin (e.g. localhost)
 * than the auth service (e.g. Railway).
 */

// Helper to ensure callbackURL is absolute
function ensureAbsoluteURL(url: string, fallbackOrigin: string): string {
  try {
    // If it's already absolute, return as-is
    new URL(url);
    return url;
  } catch {
    // If relative, make it absolute using fallbackOrigin
    const base = new URL(fallbackOrigin);
    return new URL(url, base.origin).toString();
  }
}

// Handle GET requests - redirect to the oauth-init page or process directly
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const searchParams = req.nextUrl.searchParams;
  const provider = searchParams.get("provider") || "github";
  let callbackURL = searchParams.get("callbackURL") || "/";
  const errorCallbackURL = searchParams.get("errorCallbackURL");
  
  // Ensure callbackURL is absolute - use origin or referer as fallback
  const fallbackOrigin = origin || req.headers.get("referer") || "http://localhost:3000";
  callbackURL = ensureAbsoluteURL(callbackURL, fallbackOrigin);

  try {
    const base = new URL(req.url);
    const authUrl = new URL("/api/auth/sign-in/social", base.origin);
    
    const res = await fetch(authUrl.toString(), {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cookie": req.headers.get("cookie") || "", // Forward existing cookies
      },
      body: JSON.stringify({
        provider,
        callbackURL,
        ...(errorCallbackURL && { errorCallbackURL }),
      }),
    });

    if (!res.ok) {
      throw new Error(`Auth service returned ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as { url?: string; error?: string };
    const redirectUrl = data?.url;
    
    if (!redirectUrl) {
      const err = data?.error || "No redirect URL from auth";
      // Use the callbackURL for errors
      const errorPage = new URL(callbackURL);
      errorPage.searchParams.set("error", "oauth_init_failed");
      errorPage.searchParams.set("error_description", err);
      const r = NextResponse.redirect(errorPage, 302);
      return addCorsHeaders(r, origin);
    }

    const out = NextResponse.redirect(redirectUrl, 302);
    
    // Forward cookies from Better-auth response
    const setCookies: string[] =
      typeof (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (res.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
        : [];
    
    for (const cookie of setCookies) {
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
    console.error("oauth-init GET error:", e);
    // Use callbackURL for errors
    const errorPage = new URL(callbackURL);
    errorPage.searchParams.set("error", "oauth_init_failed");
    errorPage.searchParams.set(
      "error_description",
      e instanceof Error ? e.message : "Unknown error"
    );
    const r = NextResponse.redirect(errorPage, 302);
    return addCorsHeaders(r, origin);
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
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
    let callbackURL = body.callbackURL || "/";
    const errorCallbackURL = body.errorCallbackURL;
    
    // Ensure callbackURL is absolute
    const fallbackOrigin = origin || req.headers.get("referer") || "http://localhost:3000";
    callbackURL = ensureAbsoluteURL(callbackURL, fallbackOrigin);

    const base = new URL(req.url);
    const authUrl = new URL("/api/auth/sign-in/social", base.origin);
    
    const res = await fetch(authUrl.toString(), {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cookie": req.headers.get("cookie") || "", // Forward existing cookies
      },
      body: JSON.stringify({
        provider,
        callbackURL,
        ...(errorCallbackURL && { errorCallbackURL }),
      }),
    });

    if (!res.ok) {
      throw new Error(`Auth service returned ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as { url?: string; error?: string };
    const redirectUrl = data?.url;
    
    if (!redirectUrl) {
      const err = data?.error || "No redirect URL from auth";
      // Use callbackURL for errors
      const errorPage = new URL(callbackURL);
      errorPage.searchParams.set("error", "oauth_init_failed");
      errorPage.searchParams.set("error_description", err);
      const r = NextResponse.redirect(errorPage, 302);
      return addCorsHeaders(r, origin);
    }

    const out = NextResponse.redirect(redirectUrl, 302);
    
    // Forward cookies from Better-auth response
    // This is critical for OAuth state management across origins
    const setCookies: string[] =
      typeof (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (res.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
        : [];
    
    for (const cookie of setCookies) {
      // Parse and modify cookie to ensure it works cross-origin
      // Better-auth cookies need to be accessible when GitHub redirects back
      const cookieParts = cookie.split(';');
      const [nameValue] = cookieParts;
      
      // Reconstruct cookie with SameSite=None and Secure for cross-origin
      // This allows the cookie to be sent when GitHub redirects back
      let modifiedCookie = nameValue;
      
      // Add SameSite=None and Secure if not already present
      if (!cookie.includes('SameSite=')) {
        modifiedCookie += '; SameSite=None';
      }
      if (!cookie.includes('Secure')) {
        modifiedCookie += '; Secure';
      }
      
      // Preserve other attributes (Path, HttpOnly, etc.)
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
    console.error("oauth-init POST error:", e);
    // Use callbackURL for errors
    const errorPage = new URL(callbackURL);
    errorPage.searchParams.set("error", "oauth_init_failed");
    errorPage.searchParams.set(
      "error_description",
      e instanceof Error ? e.message : "Unknown error"
    );
    const r = NextResponse.redirect(errorPage, 302);
    return addCorsHeaders(r, origin);
  }
}
