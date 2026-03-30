import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  sendBookingReceivedEmail,
  sendNewBookingNotificationEmail,
} from "@/lib/email";
import type {
  BookingType,
  BookingSize,
  ColorPreference,
  BookingLocation,
} from "@/lib/supabase/database.types";

// Validation helpers
const VALID_TYPES: BookingType[] = ["flash", "custom", "consultation", "coverup", "rework"];
const VALID_SIZES: BookingSize[] = ["small", "medium", "large", "xlarge"];
const VALID_COLORS: ColorPreference[] = ["blackgrey", "color", "both"];
const VALID_LOCATIONS: BookingLocation[] = ["malmo", "copenhagen"];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Validate required fields ──────────────────────────
    const errors: string[] = [];

    if (!body.location || !VALID_LOCATIONS.includes(body.location)) {
      errors.push("Invalid or missing location");
    }
    if (!body.type || !VALID_TYPES.includes(body.type)) {
      errors.push("Invalid or missing request type");
    }
    if (!body.size || !VALID_SIZES.includes(body.size)) {
      errors.push("Invalid or missing size");
    }
    if (!body.color || !VALID_COLORS.includes(body.color)) {
      errors.push("Invalid or missing color preference");
    }
    if (!body.client_name?.trim()) {
      errors.push("Name is required");
    }
    if (!body.client_email?.trim() || !isValidEmail(body.client_email)) {
      errors.push("Valid email is required");
    }

    if (errors.length > 0) {
      return Response.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    // ── Insert booking ────────────────────────────────────
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        location: body.location as BookingLocation,
        type: body.type as BookingType,
        description: body.description?.trim() || "",
        placement: body.placement?.trim() || "",
        size: body.size as BookingSize,
        color: body.color as ColorPreference,
        allergies: body.allergies?.trim() || null,
        client_name: body.client_name.trim(),
        client_email: body.client_email.trim().toLowerCase(),
        client_phone: body.client_phone?.trim() || null,
        appointment_date: body.appointment_date || null,
        appointment_end: body.appointment_end || null,
        preferred_dates: body.preferred_dates?.trim() || null,
        referrer: body.referrer?.trim() || null,
        utm_source: body.utm_source?.trim() || null,
        utm_medium: body.utm_medium?.trim() || null,
        utm_campaign: body.utm_campaign?.trim() || null,
        utm_content: body.utm_content?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return Response.json(
        { error: "Failed to create booking" },
        { status: 500 }
      );
    }

    // Send emails in parallel (non-blocking — don't fail the request if email fails)
    Promise.allSettled([
      sendBookingReceivedEmail(data),
      sendNewBookingNotificationEmail(data),
    ]).then((results) => {
      results.forEach((result, i) => {
        if (result.status === "rejected") {
          console.error(`Email ${i} failed:`, result.reason);
        }
      });
    });

    return Response.json(
      { message: "Booking created", booking: { id: data.id, status: data.status } },
      { status: 201 }
    );
  } catch (err) {
    console.error("Booking API error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
