import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import {
  sendBookingApprovedEmail,
  sendBookingDeclinedEmail,
  sendAftercareEmail,
} from "@/lib/email";
import { createBookingEvent, deleteBookingEvent } from "@/lib/google-calendar";
import type { BookingStatus, BookingRow } from "@/lib/supabase/database.types";

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
    const body = await request.json();
    const { id, status, admin_notes, deposit_amount, appointment_date } = body;

    if (!id || !status) {
      return Response.json(
        { error: "Booking ID and status are required" },
        { status: 400 }
      );
    }

    const validStatuses: BookingStatus[] = [
      "pending",
      "approved",
      "declined",
      "deposit_paid",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
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

    // Build update payload
    const updatePayload: Record<string, unknown> = { status };
    if (admin_notes !== undefined) updatePayload.admin_notes = admin_notes;
    if (deposit_amount !== undefined) updatePayload.deposit_amount = deposit_amount;
    if (appointment_date !== undefined) updatePayload.appointment_date = appointment_date;

    // ── Calendar integration ─────────────────────────────
    // Create event when deposit is paid (Malmö bookings with appointment dates)
    if (
      status === "deposit_paid" &&
      (currentBooking as BookingRow).location === "malmo" &&
      (currentBooking as BookingRow).appointment_date &&
      !(currentBooking as BookingRow).calendar_event_id
    ) {
      try {
        const eventId = await createBookingEvent(currentBooking as BookingRow);
        updatePayload.calendar_event_id = eventId;
        console.log(`Calendar event created: ${eventId} for booking ${id}`);
      } catch (calErr) {
        console.error("Failed to create calendar event:", calErr);
        // Don't block the status update — calendar event is non-critical
      }
    }

    // Delete event when booking is cancelled
    if (
      status === "cancelled" &&
      (currentBooking as BookingRow).calendar_event_id
    ) {
      try {
        await deleteBookingEvent((currentBooking as BookingRow).calendar_event_id!);
        updatePayload.calendar_event_id = null;
        console.log(`Calendar event deleted for booking ${id}`);
      } catch (calErr) {
        console.error("Failed to delete calendar event:", calErr);
        // Don't block the cancellation
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
      if (status === "approved") {
        await sendBookingApprovedEmail(data, admin_notes || undefined);
      } else if (status === "declined") {
        await sendBookingDeclinedEmail(data, admin_notes || undefined);
      } else if (status === "completed") {
        await sendAftercareEmail(data);
      }
    } catch (emailErr) {
      // Log but don't fail the request — booking update already succeeded
      console.error("Email send error after status update:", emailErr);
    }

    return Response.json({
      message: "Booking updated",
      booking: data,
    });
  } catch {
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
