import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots, BOOKING_WINDOW_DAYS } from "@/lib/google-calendar";
import type { BookingSize } from "@/lib/supabase/database.types";

const VALID_SIZES: BookingSize[] = ["small", "medium", "large", "xlarge"];

/**
 * GET /api/calendar/availability?size=medium&start=2026-04-01&end=2026-04-07
 *
 * Returns available time slots for Studio Diamant (Malmö).
 * Only free/busy data — no event details exposed (privacy-safe).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const size = searchParams.get("size") as BookingSize | null;
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    // ── Validate ──
    if (!size || !VALID_SIZES.includes(size)) {
      return NextResponse.json(
        { error: "Invalid or missing size parameter" },
        { status: 400 }
      );
    }

    if (!start || !end) {
      return NextResponse.json(
        { error: "start and end date parameters are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Basic date format check
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start) || !dateRegex.test(end)) {
      return NextResponse.json(
        { error: "Dates must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    // Don't allow more than the booking window
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffDays =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays > BOOKING_WINDOW_DAYS) {
      return NextResponse.json(
        { error: `Date range cannot exceed ${BOOKING_WINDOW_DAYS} days` },
        { status: 400 }
      );
    }

    if (diffDays < 0) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    // ── Fetch availability ──
    const days = await getAvailableSlots(size, start, end);

    return NextResponse.json(
      { days },
      {
        headers: {
          // Cache for 5 minutes — availability changes are not instant anyway
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Calendar availability error:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
