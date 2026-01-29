/**
 * Runs once when the Node.js server starts, before any app code loads.
 * Patches fetch so requests to GitHub API include User-Agent (required by GitHub).
 * This must run before better-auth/@better-fetch loads, so they capture the patched fetch.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const origFetch = globalThis.fetch;
  if (typeof origFetch !== "function") return;

  const userAgent = "ClipSync-Auth/1.0 (https://clipsync-auth.up.railway.app)";

  (globalThis as any).fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url && String(url).startsWith("https://api.github.com")) {
      const headers = new Headers(init?.headers ?? undefined);
      if (!headers.has("User-Agent")) {
        headers.set("User-Agent", userAgent);
      }
      init = { ...init, headers };
    }
    return origFetch.call(this, input, init);
  };
}
