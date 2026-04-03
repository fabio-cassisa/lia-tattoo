import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import {
  sendBookingApprovedEmail,
  sendBookingDeclinedEmail,
  sendAftercareEmail,
} from "@/lib/email";
import { createBookingEvent, updateBookingEvent as syncBookingEvent, deleteBookingEvent } from "@/lib/google-calendar";
import type {
  BookingStatus,
  BookingRow,
  BookingType,
  BookingSize,
  ColorPreference,
  BookingLocation,
} from "@/lib/supabase/database.types";

const VALID_STATUSES: BookingStatus[] = [
  "pending",
  "approved",
  "declined",
  "deposit_paid",
  "completed",
  "cancelled",
];

const VALID_TYPES: BookingType[] = ["flash", "custom", "consultation", "coverup", "rework"];
const VALID_SIZES: BookingSize[] = ["small", "medium", "large", "xlarge"];
const VALID_COLORS: ColorPreference[] = ["blackgrey", "color", "both"];
const VALID_LOCATIONS: BookingLocation[] = ["malmo", "copenhagen"];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getNullableString(value: unknown): string | null {
  if (value === null) return null;
  return getString(value);
}

function getNumber(value: unknown): number | null {
  if (typeof value === "string" && value.trim().length === 0) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isBookingStatus(value: unknown): value is BookingStatus {
  return VALID_STATUSES.includes(String(value) as BookingStatus);
}

function isBookingType(value: unknown): value is BookingType {
  return VALID_TYPES.includes(String(value) as BookingType);
}

function isBookingSize(value: unknown): value is BookingSize {
  return VALID_SIZES.includes(String(value) as BookingSize);
}

function isColorPreference(value: unknown): value is ColorPreference {
  return VALID_COLORS.includes(String(value) as ColorPreference);
}

function isBookingLocation(value: unknown): value is BookingLocation {
  return VALID_LOCATIONS.includes(String(value) as BookingLocation);
}

async function getBookingReferenceImagePaths(admin: ReturnType<typeof createAdminClient>, bookingId: string) {
  const { data: images, error: imagesError } = await admin
    .from("booking_images")
    .select("storage_path")
    .eq("booking_id", bookingId);

  if (imagesError) {
    throw imagesError;
  }

  return (images ?? []).map((image) => image.storage_path).filter(Boolean);
}

async function deleteBookingReferenceImages(
  admin: ReturnType<typeof createAdminClient>,
  storagePaths: string[]
) {
  if (storagePaths.length === 0) return;

  const { error: storageError } = await admin.storage.from("reference-images").remove(storagePaths);
  if (storageError) {
    throw storageError;
  }
}

/** Verify the caller is authenticated */
async function requireAuth() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }
  return user;
}

/**
 * GET /api/admin/bookings — List all bookings (optionally filtered by status)
 */
export async function GET(request: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as BookingStatus | null;

  const admin = createAdminClient();
  let query = admin
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Admin bookings query error:", error);
    return Response.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }

  return Response.json({ bookings: data });
}

/**
 * PATCH /api/admin/bookings — Update booking status (approve/decline/complete)
 *
 * Body: { id: string, status: BookingStatus, admin_notes?: string, deposit_amount?: number, appointment_date?: string }
 *
 * Side-effects:
 *   - approved → sends approval email
 *   - declined → sends decline email
 *   - deposit_paid → creates Google Calendar event (Malmö only)
 *   - completed → sends aftercare email
 *   - cancelled → deletes Google Calendar event if it exists
 */
export async function PATCH(request: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = getString(body.id);
    const action = getString(body.action) ?? "update";

    if (!id) {
      return Response.json(
        { error: "Booking ID is required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Fetch current booking state (needed for calendar operations)
    const { data: currentBooking } = await admin
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

    if (!currentBooking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    if (action === "delete") {
      let storageWarning: string | null = null;
      let storagePaths: string[] = [];

      try {
        storagePaths = await getBookingReferenceImagePaths(admin, id);
      } catch (storageErr) {
        console.error("Failed to read booking reference images before deletion:", storageErr);
      }

      try {
        if (currentBooking.calendar_event_id) {
          await deleteBookingEvent(currentBooking.calendar_event_id);
        }
      } catch (calErr) {
        console.error("Failed to delete calendar event before booking deletion:", calErr);
      }

      const { error: deleteError } = await admin.from("bookings").delete().eq("id", id);

      if (deleteError) {
        console.error("Admin booking delete error:", deleteError);
        return Response.json({ error: "Failed to delete booking" }, { status: 500 });
      }

      try {
        await deleteBookingReferenceImages(admin, storagePaths);
      } catch (storageErr) {
        console.error("Failed to delete booking reference images:", storageErr);
        storageWarning = storageErr instanceof Error ? storageErr.message : String(storageErr);
      }

      return Response.json({
        message: "Booking deleted",
        id,
        ...(storageWarning ? { storage_warning: storageWarning } : {}),
      });
    }

    const status = body.status;
    if (status !== undefined && !isBookingStatus(status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {};
    if (status !== undefined) updatePayload.status = status;
    if (body.location !== undefined) {
      if (!isBookingLocation(body.location)) {
        return Response.json({ error: "Invalid location" }, { status: 400 });
      }
      updatePayload.location = body.location;
    }
    if (body.type !== undefined) {
      if (!isBookingType(body.type)) {
        return Response.json({ error: "Invalid request type" }, { status: 400 });
      }
      updatePayload.type = body.type;
    }
    if (body.size !== undefined) {
      if (!isBookingSize(body.size)) {
        return Response.json({ error: "Invalid size" }, { status: 400 });
      }
      updatePayload.size = body.size;
    }
    if (body.color !== undefined) {
      if (!isColorPreference(body.color)) {
        return Response.json({ error: "Invalid color preference" }, { status: 400 });
      }
      updatePayload.color = body.color;
    }
    if (body.client_name !== undefined) {
      const clientName = getString(body.client_name);
      if (!clientName) {
        return Response.json({ error: "Client name is required" }, { status: 400 });
      }
      updatePayload.client_name = clientName;
    }
    if (body.client_email !== undefined) {
      const clientEmail = getString(body.client_email);
      if (!clientEmail) {
        return Response.json({ error: "Client email is required" }, { status: 400 });
      }
      if (!isValidEmail(clientEmail)) {
        return Response.json({ error: "Client email is invalid" }, { status: 400 });
      }
      updatePayload.client_email = clientEmail.toLowerCase();
    }
    if (body.description !== undefined) updatePayload.description = getNullableString(body.description) ?? "";
    if (body.placement !== undefined) updatePayload.placement = getNullableString(body.placement) ?? "";
    if (body.allergies !== undefined) updatePayload.allergies = getNullableString(body.allergies);
    if (body.client_phone !== undefined) updatePayload.client_phone = getNullableString(body.client_phone);
    if (body.admin_notes !== undefined) updatePayload.admin_notes = getNullableString(body.admin_notes);
    if (body.preferred_dates !== undefined) updatePayload.preferred_dates = getNullableString(body.preferred_dates);
    if (body.deposit_amount !== undefined) updatePayload.deposit_amount = getNumber(body.deposit_amount);
    if (body.appointment_date !== undefined) updatePayload.appointment_date = getNullableString(body.appointment_date);
    if (body.appointment_end !== undefined) updatePayload.appointment_end = getNullableString(body.appointment_end);

    if (Object.keys(updatePayload).length === 0) {
      return Response.json({ error: "No valid booking fields to update" }, { status: 400 });
    }

    // ── Calendar integration ─────────────────────────────
    let calendarError: string | null = null;
    const nextBooking: BookingRow = {
      ...currentBooking,
      ...updatePayload,
    } as BookingRow;
    const hasCalendarEvent = Boolean(currentBooking.calendar_event_id);
    const shouldKeepCalendarEvent =
      nextBooking.location === "malmo" &&
      Boolean(nextBooking.appointment_date) &&
      (nextBooking.status === "deposit_paid" || nextBooking.status === "completed");
    const shouldCreateCalendarEvent =
      !hasCalendarEvent &&
      nextBooking.location === "malmo" &&
      Boolean(nextBooking.appointment_date) &&
      nextBooking.status === "deposit_paid";

    if (shouldCreateCalendarEvent) {
      try {
        const eventId = await createBookingEvent(nextBooking);
        updatePayload.calendar_event_id = eventId;
        console.log(`Calendar event created: ${eventId} for booking ${id}`);
      } catch (calErr) {
        const errMsg = calErr instanceof Error
          ? `${calErr.message}\n${calErr.stack}`
          : String(calErr);
        console.error("Failed to create calendar event:", errMsg);
        calendarError = errMsg;
        // Don't block the status update — calendar event is non-critical
      }
    }

    if (hasCalendarEvent && !shouldKeepCalendarEvent) {
      try {
        await deleteBookingEvent(currentBooking.calendar_event_id!);
        updatePayload.calendar_event_id = null;
        console.log(`Calendar event deleted for booking ${id}`);
      } catch (calErr) {
        console.error("Failed to delete calendar event:", calErr);
        calendarError = calErr instanceof Error ? calErr.message : String(calErr);
      }
    }

    if (hasCalendarEvent && shouldKeepCalendarEvent && !Object.prototype.hasOwnProperty.call(updatePayload, "calendar_event_id")) {
      try {
        await syncBookingEvent(currentBooking.calendar_event_id!, nextBooking);
        console.log(`Calendar event updated for booking ${id}`);
      } catch (calErr) {
        const errMsg = calErr instanceof Error
          ? `${calErr.message}\n${calErr.stack}`
          : String(calErr);
        console.error("Failed to update calendar event:", errMsg);
        calendarError = calendarError ? `${calendarError}\n${errMsg}` : errMsg;
      }
    }

    const { data, error } = await admin
      .from("bookings")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Admin booking update error:", error);
      return Response.json(
        { error: "Failed to update booking" },
        { status: 500 }
      );
    }

    // ── Trigger emails based on status change ─────────────
    try {
      if (status === "approved" && currentBooking.status !== "approved") {
        await sendBookingApprovedEmail(data, getString(body.admin_notes) || undefined);
      } else if (status === "declined" && currentBooking.status !== "declined") {
        await sendBookingDeclinedEmail(data, getString(body.admin_notes) || undefined);
      } else if (status === "completed" && currentBooking.status !== "completed") {
        await sendAftercareEmail(data);
      }
    } catch (emailErr) {
      // Log but don't fail the request — booking update already succeeded
      console.error("Email send error after status update:", emailErr);
    }

    return Response.json({
      message: "Booking updated",
      booking: data,
      ...(calendarError && { calendar_error: calendarError }),
    });
  } catch {
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
