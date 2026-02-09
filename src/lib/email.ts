import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

/** Resend client (lazy). Only created when API key is set. */
function getResend(): Resend | null {
  if (!resendApiKey) return null;
  return new Resend(resendApiKey);
}

export type WelcomeEmailUser = {
  email: string;
  name?: string | null;
};


export async function sendWelcomeEmail(user: WelcomeEmailUser): Promise<void> {
  const resend = getResend();
  if (!resend) {
    if (process.env.NODE_ENV === "development") {
      console.log("[email] RESEND_API_KEY not set, skipping welcome email to", user.email);
    }
    return;
  }

  const displayName = user.name?.trim() || "there";

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject: "Welcome to ClipSync",
      html: `
        <p>Hi ${escapeHtml(displayName)},</p>
        <p>You have successfully onboarded to <strong>ClipSync</strong>. We're glad to have you!</p>
        <p>Get started by signing in and exploring the app.</p>
        <p>— The ClipSync Team</p>
      `,
    });

    if (error) {
      console.error("[email] Resend error sending welcome email:", error);
    }
  } catch (err) {
    console.error("[email] Failed to send welcome email to", user.email, err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
