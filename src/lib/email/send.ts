import { getResend, FROM_EMAIL, getLiaEmail } from "./resend";
import {
  emailWrapper,
  sectionHeading,
  detailRow,
  detailsTable,
  ctaButton,
  BRAND,
} from "./templates";
import type { BookingRow } from "@/lib/supabase/database.types";

// ── Human-readable label maps ─────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  flash: "Flash design",
  custom: "Custom design",
  consultation: "Consultation",
  coverup: "Cover-up",
  rework: "Rework",
};

const SIZE_LABELS: Record<string, string> = {
  small: "Small (< 5 cm)",
  medium: "Medium (5-10 cm)",
  large: "Large (10-20 cm)",
  xlarge: "X-Large (> 20 cm)",
};

const COLOR_LABELS: Record<string, string> = {
  blackgrey: "Black & Grey",
  color: "Color",
  both: "Both",
};

const LOCATION_LABELS: Record<string, string> = {
  malmo: "Malmö — Studio Diamant",
  copenhagen: "Copenhagen — Good Morning Tattoo",
};

function bookingDetailsHtml(booking: BookingRow): string {
  return detailsTable(
    detailRow("Location", LOCATION_LABELS[booking.location] ?? booking.location) +
    detailRow("Type", TYPE_LABELS[booking.type] ?? booking.type) +
    detailRow("Size", SIZE_LABELS[booking.size] ?? booking.size) +
    detailRow("Color", COLOR_LABELS[booking.color] ?? booking.color) +
    detailRow("Placement", booking.placement || "—") +
    detailRow("Description", booking.description || "—") +
    (booking.allergies ? detailRow("Allergies", booking.allergies) : "")
  );
}

// ── 1. Booking Received (to client) ──────────────────────
export async function sendBookingReceivedEmail(booking: BookingRow) {
  const resend = getResend();

  const html = emailWrapper(`
    ${sectionHeading("Booking request received")}
    <p style="margin: 0 0 16px; font-size: 14px; color: ${BRAND.ink}; line-height: 1.6;">
      Hey ${booking.client_name.split(" ")[0]},<br><br>
      Thanks for reaching out! Your booking request has been received and Lia will review it soon.
      You'll get another email once your request has been reviewed.
    </p>
    <p style="margin: 0 0 8px; font-size: 13px; color: ${BRAND.mutedText}; font-style: italic;">
      Here's a summary of your request:
    </p>
    ${bookingDetailsHtml(booking)}
    <p style="margin: 24px 0 0; font-size: 13px; color: ${BRAND.mutedText}; line-height: 1.5;">
      If you need to make changes, just reply to this email or reach out on
      <a href="https://instagram.com/liagiorgi.one.ttt" style="color: ${BRAND.tradRed}; text-decoration: none;">Instagram</a>.
    </p>
  `);

  return resend.emails.send({
    from: FROM_EMAIL,
    to: booking.client_email,
    subject: "Booking request received — liagiorgi.one.ttt",
    html,
  });
}

// ── 2. New Booking Notification (to Lia) ─────────────────
export async function sendNewBookingNotificationEmail(booking: BookingRow) {
  const resend = getResend();
  const liaEmail = getLiaEmail();

  const html = emailWrapper(`
    ${sectionHeading("New booking request")}
    <p style="margin: 0 0 16px; font-size: 14px; color: ${BRAND.ink}; line-height: 1.6;">
      <strong>${booking.client_name}</strong> submitted a new booking request.
    </p>
    ${detailsTable(
      detailRow("Name", booking.client_name) +
      detailRow("Email", `<a href="mailto:${booking.client_email}" style="color: ${BRAND.tradRed}; text-decoration: none;">${booking.client_email}</a>`) +
      (booking.client_phone ? detailRow("Phone", booking.client_phone) : "")
    )}
    ${bookingDetailsHtml(booking)}
    ${ctaButton("Review in Dashboard", `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://lia-tattoo.vercel.app"}/admin`)}
    <p style="margin: 0; font-size: 12px; color: ${BRAND.mutedText}; text-align: center;">
      Booking ID: ${booking.id}
    </p>
  `);

  return resend.emails.send({
    from: FROM_EMAIL,
    to: liaEmail,
    subject: `New booking request from ${booking.client_name}`,
    html,
  });
}

// ── 3. Booking Approved (to client) ──────────────────────
export async function sendBookingApprovedEmail(
  booking: BookingRow,
  adminNote?: string
) {
  const resend = getResend();

  // Determine deposit amount based on tiers
  const depositText = booking.deposit_amount
    ? `${booking.deposit_amount} SEK`
    : "will be communicated separately";

  const appointmentText = booking.appointment_date
    ? new Date(booking.appointment_date).toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "To be confirmed";

  const html = emailWrapper(`
    ${sectionHeading("Your booking is approved!")}
    <p style="margin: 0 0 16px; font-size: 14px; color: ${BRAND.ink}; line-height: 1.6;">
      Great news, ${booking.client_name.split(" ")[0]}! Lia has reviewed your request and you're all set.
    </p>
    ${adminNote ? `
    <div style="margin: 0 0 20px; padding: 16px; background-color: ${BRAND.sabbia}; border-left: 3px solid ${BRAND.tradRed}; border-radius: 0 3px 3px 0;">
      <p style="margin: 0; font-size: 13px; color: ${BRAND.ink}; line-height: 1.5; font-style: italic;">
        "${adminNote}"
      </p>
      <p style="margin: 8px 0 0; font-size: 12px; color: ${BRAND.mutedText};">— Lia</p>
    </div>
    ` : ""}
    ${detailsTable(
      detailRow("Location", LOCATION_LABELS[booking.location] ?? booking.location) +
      detailRow("Date", appointmentText) +
      detailRow("Deposit", depositText)
    )}
    <div style="margin: 24px 0; padding: 20px; background-color: ${BRAND.sabbia}; border-radius: 3px; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 14px; color: ${BRAND.ink}; font-weight: bold;">
        Next step: Pay your deposit
      </p>
      <p style="margin: 0; font-size: 13px; color: ${BRAND.mutedText}; line-height: 1.5;">
        To confirm your appointment, please send the deposit (${depositText}) via PayPal.
        Lia will share the payment details with you directly.
      </p>
    </div>
    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.mutedText}; line-height: 1.5;">
      Questions? Reply to this email or reach out on
      <a href="https://instagram.com/liagiorgi.one.ttt" style="color: ${BRAND.tradRed}; text-decoration: none;">Instagram</a>.
    </p>
  `);

  return resend.emails.send({
    from: FROM_EMAIL,
    to: booking.client_email,
    subject: "Your booking is approved! — liagiorgi.one.ttt",
    html,
  });
}

// ── 4. Booking Declined (to client) ──────────────────────
export async function sendBookingDeclinedEmail(
  booking: BookingRow,
  adminNote?: string
) {
  const resend = getResend();

  const html = emailWrapper(`
    ${sectionHeading("About your booking request")}
    <p style="margin: 0 0 16px; font-size: 14px; color: ${BRAND.ink}; line-height: 1.6;">
      Hey ${booking.client_name.split(" ")[0]},<br><br>
      Thanks for your interest! Unfortunately, Lia is unable to accommodate this particular request at this time.
    </p>
    ${adminNote ? `
    <div style="margin: 0 0 20px; padding: 16px; background-color: ${BRAND.sabbia}; border-left: 3px solid ${BRAND.tradRed}; border-radius: 0 3px 3px 0;">
      <p style="margin: 0; font-size: 13px; color: ${BRAND.ink}; line-height: 1.5; font-style: italic;">
        "${adminNote}"
      </p>
      <p style="margin: 8px 0 0; font-size: 12px; color: ${BRAND.mutedText};">— Lia</p>
    </div>
    ` : ""}
    <p style="margin: 0; font-size: 14px; color: ${BRAND.ink}; line-height: 1.6;">
      Don't be discouraged — feel free to submit a new request or reach out on
      <a href="https://instagram.com/liagiorgi.one.ttt" style="color: ${BRAND.tradRed}; text-decoration: none;">Instagram</a>
      to discuss other ideas.
    </p>
  `);

  return resend.emails.send({
    from: FROM_EMAIL,
    to: booking.client_email,
    subject: "Update on your booking request — liagiorgi.one.ttt",
    html,
  });
}

// ── 5. Aftercare (to client after session) ───────────────
export async function sendAftercareEmail(booking: BookingRow) {
  const resend = getResend();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lia-tattoo.vercel.app";

  const html = emailWrapper(`
    ${sectionHeading("Your new tattoo — aftercare")}
    <p style="margin: 0 0 16px; font-size: 14px; color: ${BRAND.ink}; line-height: 1.6;">
      Hey ${booking.client_name.split(" ")[0]},<br><br>
      Thanks for trusting Lia with your new ink! Here's everything you need to know to keep it looking perfect.
    </p>

    <h3 style="margin: 24px 0 12px; font-size: 15px; color: ${BRAND.tradRed}; font-weight: normal;">The first 24 hours</h3>
    <p style="margin: 0 0 16px; font-size: 13px; color: ${BRAND.ink}; line-height: 1.6;">
      Keep the protective wrap on for <strong>2-4 hours</strong>. Then gently wash with lukewarm water and fragrance-free soap. Pat dry with a clean paper towel — never rub.
    </p>

    <h3 style="margin: 24px 0 12px; font-size: 15px; color: ${BRAND.tradRed}; font-weight: normal;">Days 2-14</h3>
    <p style="margin: 0 0 16px; font-size: 13px; color: ${BRAND.ink}; line-height: 1.6;">
      Apply a <strong>thin layer</strong> of fragrance-free moisturizer (like Bepanthen or Hustle Butter) 2-3 times a day. Your tattoo will peel and flake — this is normal. <strong>Never pick or scratch it.</strong>
    </p>

    <h3 style="margin: 24px 0 12px; font-size: 15px; color: ${BRAND.tradRed}; font-weight: normal;">What to avoid</h3>
    <ul style="margin: 0 0 16px; padding-left: 20px; font-size: 13px; color: ${BRAND.ink}; line-height: 1.8;">
      <li>Submerging in water (pools, baths, sea) for 2-3 weeks</li>
      <li>Direct sunlight on the tattoo for at least 4 weeks</li>
      <li>Tight clothing rubbing on the area</li>
      <li>Gym / heavy sweating for the first few days</li>
    </ul>

    ${ctaButton("Full Aftercare Guide", `${siteUrl}/en/aftercare`)}

    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.mutedText}; line-height: 1.5;">
      If you notice anything unusual (excessive redness, swelling, or discharge after the first couple days), don't hesitate to reach out.
      And once it's healed — Lia would love to see a photo!
    </p>
    <p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.mutedText};">
      <a href="https://instagram.com/liagiorgi.one.ttt" style="color: ${BRAND.tradRed}; text-decoration: none;">@liagiorgi.one.ttt</a>
    </p>
  `);

  return resend.emails.send({
    from: FROM_EMAIL,
    to: booking.client_email,
    subject: "Aftercare for your new tattoo — liagiorgi.one.ttt",
    html,
  });
}
