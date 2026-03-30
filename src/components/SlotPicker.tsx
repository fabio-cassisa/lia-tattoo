"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { BookingSize } from "@/lib/supabase/database.types";

type TimeSlot = {
  start: string;
  end: string;
  available: boolean;
};

type DayAvailability = {
  date: string;
  slots: TimeSlot[];
};

type SlotPickerProps = {
  size: BookingSize;
  onSlotSelect: (slot: { start: string; end: string } | null) => void;
  selectedSlot: { start: string; end: string } | null;
};

const SESSION_LABELS: Record<BookingSize, string> = {
  small: "1–2h",
  medium: "3–4h",
  large: "4–5h",
  xlarge: "Full day",
};

/**
 * Weekly calendar slot picker for Malmö bookings.
 * Fetches availability from /api/calendar and displays time slots.
 * Mobile-first: vertical day list with horizontal scroll on slots.
 */
export default function SlotPicker({
  size,
  onSlotSelect,
  selectedSlot,
}: SlotPickerProps) {
  const t = useTranslations("booking.calendar");
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);

  // Calculate the current week's date range
  const getWeekRange = useCallback((offset: number) => {
    const now = new Date();
    // Start from tomorrow if offset is 0 (can't book today)
    const start = new Date(now);
    start.setDate(start.getDate() + 1 + offset * 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    return {
      start: formatDate(start),
      end: formatDate(end),
      startDate: start,
      endDate: end,
    };
  }, []);

  // Fetch availability for the current week
  const fetchAvailability = useCallback(
    async (offset: number) => {
      setLoading(true);
      setError("");

      try {
        const { start, end } = getWeekRange(offset);
        const res = await fetch(
          `/api/calendar?size=${size}&start=${start}&end=${end}`
        );

        if (!res.ok) {
          throw new Error("Failed to fetch availability");
        }

        const data = await res.json();
        setDays(data.days || []);
      } catch {
        setError(t("error"));
        setDays([]);
      } finally {
        setLoading(false);
      }
    },
    [size, getWeekRange, t]
  );

  useEffect(() => {
    if (size) {
      fetchAvailability(weekOffset);
    }
  }, [size, weekOffset, fetchAvailability]);

  // Reset selection when size changes
  useEffect(() => {
    onSlotSelect(null);
    setWeekOffset(0);
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  const { startDate, endDate } = getWeekRange(weekOffset);
  const maxWeeks = Math.floor(90 / 7); // ~12 weeks ahead

  function handleSlotClick(slot: TimeSlot) {
    if (!slot.available) return;

    // Toggle if clicking the same slot
    if (
      selectedSlot?.start === slot.start &&
      selectedSlot?.end === slot.end
    ) {
      onSlotSelect(null);
    } else {
      onSlotSelect({ start: slot.start, end: slot.end });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with week navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
          disabled={weekOffset === 0}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center border border-ink-900/10 text-ink-900/40 disabled:opacity-20 hover:border-ink-900/20 transition-colors"
          aria-label={t("prevWeek")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 4L6 8L10 12" />
          </svg>
        </button>

        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-900/75">
            {formatDateRange(startDate, endDate)}
          </p>
          <p className="text-[10px] text-ink-900/50 mt-0.5">
            {t("sessionLength")}: {SESSION_LABELS[size]}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setWeekOffset((w) => Math.min(maxWeeks, w + 1))}
          disabled={weekOffset >= maxWeeks}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center border border-ink-900/10 text-ink-900/40 disabled:opacity-20 hover:border-ink-900/20 transition-colors"
          aria-label={t("nextWeek")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 4L10 8L6 12" />
          </svg>
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-ink-900/10 border-t-accent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 border border-accent/30 bg-accent/5 text-sm text-accent text-center">
          {error}
        </div>
      )}

      {/* No availability */}
      {!loading && !error && days.length === 0 && (
        <div className="py-8 text-center text-sm text-ink-900/55">
          {t("noSlots")}
        </div>
      )}

      {/* Day list with slots */}
      {!loading && !error && days.length > 0 && (
        <div className="flex flex-col gap-3">
          {days.map((day) => (
            <div key={day.date} className="flex flex-col gap-2">
              {/* Day header */}
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-900/50">
                {formatDayHeader(day.date)}
              </p>

              {/* Time slots — horizontal scroll on mobile */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {day.slots.map((slot) => {
                  const isSelected =
                    selectedSlot?.start === slot.start &&
                    selectedSlot?.end === slot.end;

                  return (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => handleSlotClick(slot)}
                      disabled={!slot.available}
                      className={`flex-shrink-0 px-4 py-2.5 min-h-[44px] border text-sm transition-all ${
                        isSelected
                          ? "border-accent bg-accent/10 text-accent font-medium"
                          : slot.available
                            ? "border-ink-900/10 text-ink-900/70 hover:border-ink-900/20 hover:bg-sabbia-100/50"
                            : "border-ink-900/5 text-ink-900/15 cursor-not-allowed line-through"
                      }`}
                    >
                      {formatTime(slot.start)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected slot summary */}
      {selectedSlot && (
        <div className="p-3 border border-accent/20 bg-accent/5 text-sm text-ink-900/70">
          <span className="font-medium text-accent">
            {formatDayHeader(selectedSlot.start.split("T")[0])}
          </span>
          {" — "}
          {formatTime(selectedSlot.start)} – {formatTime(selectedSlot.end)}
        </div>
      )}
    </div>
  );
}

// ── Formatting helpers ──────────────────────────────────────

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = start.toLocaleDateString("en-GB", opts);
  const e = end.toLocaleDateString("en-GB", {
    ...opts,
    year: "numeric",
  });
  return `${s} — ${e}`;
}

function formatDayHeader(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00"); // noon to avoid TZ shifts
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  // Convert UTC to Stockholm time (CET/CEST)
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
  });
}
