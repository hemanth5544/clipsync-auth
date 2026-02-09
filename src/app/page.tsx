"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ;

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const description = searchParams.get("error_description");

  if (!error) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>ClipSync Auth</h1>
        <p style={{ color: "#666" }}>Authentication service is running.</p>
        <a
          href={APP_URL}
          style={{
            display: "inline-block",
            marginTop: "1rem",
            color: "#0066cc",
            textDecoration: "underline",
          }}
        >
          Return to app
        </a>
      </div>
    );
  }

  const messages: Record<string, string> = {
    state_mismatch:
      "The sign-in flow was interrupted or has expired. Please try signing in again from the app.",
    please_restart_the_process: "Please try signing in again from the app.",
    no_code: "Authorization was cancelled or failed. Please try again.",
    invalid_code: "Invalid authorization. Please try again.",
    no_callback_url: "Missing callback configuration. Please try again.",
    oauth_provider_not_found: "OAuth provider not configured.",
    unable_to_get_user_info: "Could not get your profile from the provider. Please try again.",
    oauth_init_failed: "Could not start sign-in. Please try again.",
  };
  const message = description || messages[error] || "Something went wrong. Please try again.";

  return (
    <div
      style={{
        maxWidth: "28rem",
        margin: "4rem auto",
        padding: "2rem",
        textAlign: "center",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        backgroundColor: "#fff",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Authentication failed</h1>
      <p style={{ color: "#4b5563", marginBottom: "1.5rem", lineHeight: 1.5 }}>{message}</p>
      <a
        href={APP_URL}
        style={{
          display: "inline-block",
          padding: "0.5rem 1rem",
          backgroundColor: "#111",
          color: "#fff",
          textDecoration: "none",
          borderRadius: "6px",
          fontWeight: 500,
        }}
      >
        Return to app
      </a>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Loading…</div>}>
      <AuthErrorContent />
    </Suspense>
  );
}
