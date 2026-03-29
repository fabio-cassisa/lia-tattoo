import { Resend } from "resend";

// Singleton Resend client
let resendClient: Resend | null = null;

export function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Sender address.
 * Using Resend's default until a custom domain (e.g. @liagiorgi.one) is set up.
 * Change this once DNS is configured.
 */
export const FROM_EMAIL = "liagiorgi.one.ttt <onboarding@resend.dev>";

/**
 * Lia's email for admin notifications.
 */
export function getLiaEmail(): string {
  const email = process.env.LIA_EMAIL;
  if (!email) {
    throw new Error("LIA_EMAIL environment variable is not set");
  }
  return email;
}
