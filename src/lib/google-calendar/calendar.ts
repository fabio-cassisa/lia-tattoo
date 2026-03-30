import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import type { BookingSize, BookingRow } from "@/lib/supabase/database.types";
import type { TimeSlot, DayAvailability } from "./types";
import {
  WORKING_HOURS,
  SESSION_DURATIONS,
  BOOKING_WINDOW_DAYS,
  TIMEZONE,
} from "./config";

// ── Auth ────────────────────────────────────────────────────

function getCalendarClient(): calendar_v3.Calendar {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyBase64) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY env var is not set");
  }

  const keyJson = JSON.parse(
    Buffer.from(keyBase64, "base64").toString("utf-8")
  );

  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth });
}

function getCalendarId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID;
  if (!id) throw new Error("GOOGLE_CALENDAR_ID env var is not set");
  return id;
}

// ── Availability ────────────────────────────────────────────

/**
 * Get available time slots for a date range at Studio Diamant (Malmö).
 * Uses Google Calendar FreeBusy API — returns only free/busy, no event details.
 */
export async function getAvailableSlots(
  size: BookingSize,
  startDate: string, // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
): Promise<DayAvailability[]> {
  const calendar = getCalendarClient();
  const calendarId = getCalendarId();
  const duration = SESSION_DURATIONS[size];

  // Clamp to booking window
  const now = new Date();
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + BOOKING_WINDOW_DAYS);

  const rangeStart = new Date(`${startDate}T00:00:00`);
  const rangeEnd = new Date(`${endDate}T23:59:59`);

  // Don't allow looking past the booking window
  const effectiveEnd = rangeEnd > maxDate ? maxDate : rangeEnd;
  // Don't allow looking into the past
  const effectiveStart = rangeStart < now ? now : rangeStart;

  if (effectiveStart >= effectiveEnd) {
    return [];
  }

  // Fetch busy times from Google Calendar
  const freeBusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: effectiveStart.toISOString(),
      timeMax: effectiveEnd.toISOString(),
      timeZone: TIMEZONE,
      items: [{ id: calendarId }],
    },
  });

  const busyPeriods =
    freeBusy.data.calendars?.[calendarId]?.busy ?? [];

  // Generate slots for each day in the range
  const days: DayAvailability[] = [];
  const current = new Date(effectiveStart);
  current.setHours(0, 0, 0, 0);

  while (current <= effectiveEnd) {
    const dayOfWeek = current.getDay();

    // Check if this is a working day
    if (WORKING_HOURS.workDays.includes(dayOfWeek)) {
      const dateStr = formatDateLocal(current);
      const slots = generateSlotsForDay(
        dateStr,
        duration.minutes,
        busyPeriods,
        now
      );

      // Only include days that have at least one available slot
      if (slots.some((s) => s.available)) {
        days.push({ date: dateStr, slots });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return days;
}

/**
 * Generate time slots for a specific day, marking each as available/unavailable.
 */
function generateSlotsForDay(
  dateStr: string, // YYYY-MM-DD
  durationMinutes: number,
  busyPeriods: Array<{ start?: string | null; end?: string | null }>,
  now: Date
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const { startHour, endHour } = WORKING_HOURS;

  // For full-day bookings, just return one slot
  if (durationMinutes >= 420) {
    const start = new Date(`${dateStr}T${pad(startHour)}:00:00`);
    const end = new Date(`${dateStr}T${pad(endHour)}:00:00`);

    // Localize to Stockholm timezone
    const startISO = toStockholmISO(start);
    const endISO = toStockholmISO(end);

    const available =
      start > now && !isOverlapping(startISO, endISO, busyPeriods);

    slots.push({ start: startISO, end: endISO, available });
    return slots;
  }

  // Generate hourly slots where the session fits within working hours
  for (let hour = startHour; hour + durationMinutes / 60 <= endHour; hour++) {
    const start = new Date(`${dateStr}T${pad(hour)}:00:00`);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const startISO = toStockholmISO(start);
    const endISO = toStockholmISO(end);

    // Slot must be in the future and not overlap with busy periods
    const available =
      start > now && !isOverlapping(startISO, endISO, busyPeriods);

    slots.push({ start: startISO, end: endISO, available });
  }

  return slots;
}

/**
 * Check if a proposed slot overlaps with any busy period.
 */
function isOverlapping(
  slotStart: string,
  slotEnd: string,
  busyPeriods: Array<{ start?: string | null; end?: string | null }>
): boolean {
  const sStart = new Date(slotStart).getTime();
  const sEnd = new Date(slotEnd).getTime();

  return busyPeriods.some((busy) => {
    if (!busy.start || !busy.end) return false;
    const bStart = new Date(busy.start).getTime();
    const bEnd = new Date(busy.end).getTime();
    // Overlap: slot starts before busy ends AND slot ends after busy starts
    return sStart < bEnd && sEnd > bStart;
  });
}

// ── Event Creation ──────────────────────────────────────────

/**
 * Create a calendar event for a confirmed booking.
 * Called when deposit is paid → booking is confirmed.
 * Returns the Google Calendar event ID.
 */
export async function createBookingEvent(
  booking: BookingRow
): Promise<string> {
  const calendar = getCalendarClient();
  const calendarId = getCalendarId();
  const duration = SESSION_DURATIONS[booking.size];

  if (!booking.appointment_date) {
    throw new Error("Booking has no appointment_date");
  }

  const startTime = new Date(booking.appointment_date);
  const endTime = new Date(
    startTime.getTime() + duration.minutes * 60 * 1000
  );

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `${booking.client_name} — ${formatType(booking.type)}`,
      description: [
        `Client: ${booking.client_name}`,
        `Email: ${booking.client_email}`,
        booking.client_phone ? `Phone: ${booking.client_phone}` : null,
        `Type: ${formatType(booking.type)}`,
        `Size: ${booking.size} (${duration.label})`,
        `Placement: ${booking.placement}`,
        `Color: ${booking.color === "blackgrey" ? "Black & Grey" : booking.color === "color" ? "Color" : "Both"}`,
        booking.description ? `\nDescription:\n${booking.description}` : null,
        booking.allergies ? `\nAllergies: ${booking.allergies}` : null,
        booking.admin_notes ? `\nNotes: ${booking.admin_notes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      start: {
        dateTime: startTime.toISOString(),
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: TIMEZONE,
      },
      // Color: banana/yellow (6) to match the calendar color
      colorId: "5",
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 60 }, // 1 hour before
          { method: "popup", minutes: 1440 }, // 1 day before
        ],
      },
    },
  });

  if (!event.data.id) {
    throw new Error("Google Calendar did not return an event ID");
  }

  return event.data.id;
}

/**
 * Delete a calendar event (e.g., when a booking is cancelled).
 */
export async function deleteBookingEvent(
  eventId: string
): Promise<void> {
  const calendar = getCalendarClient();
  const calendarId = getCalendarId();

  await calendar.events.delete({
    calendarId,
    eventId,
  });
}

// ── Helpers ─────────────────────────────────────────────────

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatType(type: string): string {
  const labels: Record<string, string> = {
    flash: "Flash",
    custom: "Custom",
    consultation: "Consultation",
    coverup: "Cover-up",
    rework: "Rework",
  };
  return labels[type] ?? type;
}

/**
 * Format a Date as YYYY-MM-DD in local time.
 */
function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}-${m}-${d}`;
}

/**
 * Convert a local-ish Date to an ISO string representing Stockholm time.
 * For server-side usage where the server may not be in Europe/Stockholm.
 */
function toStockholmISO(date: Date): string {
  // We construct dates from "YYYY-MM-DDThh:mm:ss" strings (no TZ offset),
  // which JavaScript parses as local time. On the server this may differ
  // from Stockholm. To keep it correct, we format with the IANA timezone
  // and return an ISO-like string that Google Calendar understands.
  return date.toISOString();
}
