import type { BookingSize } from "@/lib/supabase/database.types";
import type { SessionDuration } from "./types";

/**
 * Working hours for Studio Diamant (Malmö).
 * Mon–Sun, 11:00–18:00 Europe/Stockholm.
 * Copenhagen has no fixed hours — clients propose preferred dates.
 */
export const WORKING_HOURS = {
  /** Start hour (24h format) */
  startHour: 11,
  /** End hour (24h format) — last slot must END by this time */
  endHour: 18,
  /** Days of the week that are open (0=Sun, 1=Mon, ..., 6=Sat) */
  workDays: [0, 1, 2, 3, 4, 5, 6] as number[],
};

/**
 * Session durations mapped to booking size.
 * Slot granularity = 1 hour (slots snap to hour boundaries).
 */
export const SESSION_DURATIONS: Record<BookingSize, SessionDuration> = {
  small: { size: "small", label: "1–2 hours", minutes: 120 },
  medium: { size: "medium", label: "3–4 hours", minutes: 240 },
  large: { size: "large", label: "4–5 hours", minutes: 300 },
  xlarge: { size: "xlarge", label: "Full day", minutes: 420 }, // 11:00–18:00
};

/** How far ahead clients can book (in days) */
export const BOOKING_WINDOW_DAYS = 90;

/** Timezone for all calendar operations */
export const TIMEZONE = "Europe/Stockholm";
