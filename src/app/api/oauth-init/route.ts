import { NextRequest, NextResponse } from "next/server";
import { addCorsHeaders } from "@/lib/cors";

function getAuthOrigin(): string {
  const raw =
    process.env.BETTER_AUTH_BASE_URL ||
    process.env.AUTH_SERVICE_URL ||
    "";
  if (!raw) return "";
  try {
    return new URL(raw.replace(/\/+$/, "")).origin;
  } catch {
    return "";
  }
}

/**
 * Proxies form POST to /api/auth/sign-in/social, then returns 302 + forwards
 * Set-Cookie so the OAuth state is stored in the user's browser. This fixes
 * state_mismatch when the client app runs on a different origin (e.g. localhost)
 * than the auth service (e.g. Railway).
 * Uses BETTER_AUTH_BASE_URL / AUTH_SERVICE_URL for fetch and redirect so we
 * never hit localhost when deployed on Railway.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const authOrigin = getAuthOrigin();
  const baseOrigin = authOrigin || (() => {
    try {
      return new URL(req.url).origin;
    } catch {
      return "http://localhost:3001";
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

    const signInUrl = `${baseOrigin}/api/auth/sign-in/social`;
    const res = await fetch(signInUrl, {
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
      const errorPage = new URL("/", baseOrigin);
      errorPage.searchParams.set("error", "oauth_init_failed");
      errorPage.searchParams.set("error_description", err);
      const r = NextResponse.redirect(errorPage, 302);
      return addCorsHeaders(r, origin);
    }

    const out = NextResponse.redirect(redirectUrl, 302);
    const setCookies: string[] =
      typeof (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (res.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
        : [];
    for (const c of setCookies) {
      out.headers.append("Set-Cookie", c);
    }
    return addCorsHeaders(out, origin);
  } catch (e) {
    console.error("oauth-init error:", e);
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
