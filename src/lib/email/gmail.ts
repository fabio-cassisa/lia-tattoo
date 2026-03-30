import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// ── Singleton Nodemailer transporter (Gmail SMTP) ────────
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      throw new Error(
        "GMAIL_USER and GMAIL_APP_PASSWORD environment variables must be set. " +
          "Create an App Password at https://myaccount.google.com/apppasswords"
      );
    }

    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}

/**
 * From address — uses Lia's Gmail with her brand name.
 * Clients see: "liagiorgi.one.ttt <liagiorgi.one@gmail.com>"
 */
export function getFromEmail(): string {
  const user = process.env.GMAIL_USER;
  if (!user) throw new Error("GMAIL_USER environment variable is not set");
  return `liagiorgi.one.ttt <${user}>`;
}

/**
 * Lia's email for admin notifications.
 */
export function getLiaEmail(): string {
  const email = process.env.LIA_EMAIL;
  if (!email) throw new Error("LIA_EMAIL environment variable is not set");
  return email;
}

/**
 * Optional PayPal.me link used in deposit request emails.
 */
export function getPaypalMeUrl(): string | null {
  const url = process.env.PAYPAL_ME_URL?.trim();
  return url || null;
}

/**
 * Send an email via Gmail SMTP.
 * Drop-in replacement for Resend's emails.send().
 */
export async function sendEmail(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const t = getTransporter();
  const info = await t.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
  return { id: info.messageId };
}
