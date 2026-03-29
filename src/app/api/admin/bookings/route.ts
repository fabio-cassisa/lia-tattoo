import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import {
  sendBookingApprovedEmail,
  sendBookingDeclinedEmail,
  sendAftercareEmail,
} from "@/lib/email";
import type { BookingStatus } from "@/lib/supabase/database.types";

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

    // Build update payload
    const updatePayload: Record<string, unknown> = { status };
    if (admin_notes !== undefined) updatePayload.admin_notes = admin_notes;
    if (deposit_amount !== undefined) updatePayload.deposit_amount = deposit_amount;
    if (appointment_date !== undefined) updatePayload.appointment_date = appointment_date;

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
