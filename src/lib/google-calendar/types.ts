import type { BookingSize } from "@/lib/supabase/database.types";

export type TimeSlot = {
  start: string; // ISO 8601
  end: string; // ISO 8601
  available: boolean;
};

export type DayAvailability = {
  date: string; // YYYY-MM-DD
  slots: TimeSlot[];
};

/** Duration in minutes for each booking size */
export type SessionDuration = {
  size: BookingSize;
  label: string;
  minutes: number;
};
