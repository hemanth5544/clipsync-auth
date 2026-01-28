import { NextRequest, NextResponse } from "next/server";
import { addCorsHeaders } from "@/lib/cors";

/**
 * Proxies form POST to /api/auth/sign-in/social, then returns 302 + forwards
 * Set-Cookie so the OAuth state is stored in the user's browser. This fixes
 * state_mismatch when the client app runs on a different origin (e.g. localhost)
 * than the auth service (e.g. Railway).
 */
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
    const callbackURL = body.callbackURL || "/";
    const errorCallbackURL = body.errorCallbackURL;

    const base = new URL(req.url);
    const authUrl = new URL("/api/auth/sign-in/social", base.origin);
    const res = await fetch(authUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        callbackURL,
        ...(errorCallbackURL && { errorCallbackURL }),
      }),
    });

    const data = (await res.json()) as { url?: string; error?: string };
    const redirectUrl = data?.url;
    if (!redirectUrl) {
      const err = data?.error || "No redirect URL from auth";
      const errorPage = new URL("/", base.origin);
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
    console.error("oauth-init error:", e);
    const base = new URL(req.url);
    const errorPage = new URL("/", base.origin);
    errorPage.searchParams.set("error", "oauth_init_failed");
    errorPage.searchParams.set(
      "error_description",
      e instanceof Error ? e.message : "Unknown error"
    );
    const r = NextResponse.redirect(errorPage, 302);
    return addCorsHeaders(r, origin);
  }
}
