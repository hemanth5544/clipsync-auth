
const origFetch = globalThis.fetch;
if (typeof origFetch === "function") {
  const userAgent = "ClipSync-Auth/1.0 (https://clipsync-auth.up.railway.app)";
  (globalThis as any).fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url && String(url).startsWith("https://api.github.com")) {
      const headers = new Headers(init?.headers ?? undefined);
      if (!headers.has("User-Agent")) headers.set("User-Agent", userAgent);
      if (!headers.has("Accept")) headers.set("Accept", "application/vnd.github.v3+json");
      init = { ...init, headers };
    }
    return origFetch.call(this, input, init);
  };
}
