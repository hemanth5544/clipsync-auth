"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";

const OAUTH_INIT_API = "/api/oauth-init";

function OAuthInitForm() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const provider = searchParams.get("provider") || "github";
  const callbackURL = searchParams.get("callbackURL") || "/";
  const errorCallbackURL = searchParams.get("errorCallbackURL") || "";

  useEffect(() => {
    if (formRef.current) {
      formRef.current.submit();
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
      }}
    >
      <p style={{ color: "#666", marginBottom: "1rem" }}>Redirecting to {provider}…</p>
      <form ref={formRef} method="POST" action={OAUTH_INIT_API} style={{ display: "none" }}>
        <input name="provider" type="hidden" value={provider} />
        <input name="callbackURL" type="hidden" value={callbackURL} />
        {errorCallbackURL ? (
          <input name="errorCallbackURL" type="hidden" value={errorCallbackURL} />
        ) : null}
        <button type="submit">Continue</button>
      </form>
    </div>
  );
}

export default function OAuthInitPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
          }}
        >
          <p style={{ color: "#666" }}>Loading…</p>
        </div>
      }
    >
      <OAuthInitForm />
    </Suspense>
  );
}
