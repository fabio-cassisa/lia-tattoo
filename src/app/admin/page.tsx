"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getDefaultDepositAmount,
  getDepositCurrency,
} from "@/lib/bookings/deposit";
import {
  AdminEmptyState,
  AdminShell,
  AdminMetricCard,
  AdminSurface,
} from "@/components/admin/AdminShell";
import { AdminAlert, AdminButton, AdminSectionHeading } from "@/components/admin/AdminPrimitives";
import type {
  BookingStatus,
  BookingLocation,
  BookingSize,
  BookingType,
  ColorPreference,
} from "@/lib/supabase/database.types";

// ── Types ────────────────────────────────────────────────
type Booking = {
  id: string;
  created_at: string;
  updated_at: string;
  status: BookingStatus;
  location: BookingLocation;
  type: BookingType;
  description: string;
  placement: string;
  size: BookingSize;
  color: ColorPreference;
  allergies: string | null;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  admin_notes: string | null;
  deposit_amount: number | null;
  appointment_date: string | null;
  appointment_end: string | null;
  calendar_event_id: string | null;
  preferred_dates: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
};

type BookingFormState = {
  location: BookingLocation;
  type: BookingType;
  size: BookingSize;
  color: ColorPreference;
  client_name: string;
  client_email: string;
  client_phone: string;
  placement: string;
  description: string;
  allergies: string;
  preferred_dates: string;
};

// ── Label maps ───────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  flash: "Flash",
  custom: "Custom",
  consultation: "Consultation",
  coverup: "Cover-up",
  rework: "Rework",
};

const SIZE_LABELS: Record<string, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  xlarge: "X-Large",
};

const COLOR_LABELS: Record<string, string> = {
  blackgrey: "B&G",
  color: "Color",
  both: "Both",
};

const LOCATION_LABELS: Record<string, string> = {
  malmo: "Malmö / Diamant studio",
  copenhagen: "Copenhagen / Good Morning Tattoo studio",
};

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  deposit_paid: "bg-blue-100 text-blue-800",
  completed: "bg-purple-100 text-purple-800",
  cancelled: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  deposit_paid: "Deposit Paid",
  completed: "Completed",
  cancelled: "Cancelled",
};

const BOOKING_CONTROL_CLASSNAME =
  "mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground";
const BOOKING_TEXTAREA_CLASSNAME = `${BOOKING_CONTROL_CLASSNAME} min-h-[112px] resize-y`;
const STATUS_ACTION_BUTTON_CLASSNAME =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-4 py-2 text-sm text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const NEUTRAL_ACTION_BUTTON_CLASSNAME =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[var(--sabbia-300)] bg-white px-4 py-2 text-sm text-foreground-muted transition-colors hover:bg-[var(--sabbia-100)] disabled:cursor-not-allowed disabled:opacity-50";
const STATUS_FILTERS = [
  "all",
  "pending",
  "approved",
  "deposit_paid",
  "completed",
  "declined",
  "cancelled",
] as const;

function buildBookingFormState(booking: Booking): BookingFormState {
  return {
    location: booking.location,
    type: booking.type,
    size: booking.size,
    color: booking.color,
    client_name: booking.client_name,
    client_email: booking.client_email,
    client_phone: booking.client_phone ?? "",
    placement: booking.placement,
    description: booking.description,
    allergies: booking.allergies ?? "",
    preferred_dates: booking.preferred_dates ?? "",
  };
}

function getStatusSuccessMessage(status: BookingStatus): string {
  switch (status) {
    case "approved":
      return "Booking approved.";
    case "declined":
      return "Booking declined.";
    case "deposit_paid":
      return "Deposit marked as paid.";
    case "completed":
      return "Booking completed.";
    case "cancelled":
      return "Booking cancelled.";
    case "pending":
      return "Booking moved back to pending.";
  }
}

// ── Admin Dashboard ──────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const editSectionRef = useRef<HTMLDivElement>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingBooking, setEditingBooking] = useState(false);
  const [bookingForm, setBookingForm] = useState<BookingFormState | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  function getInitialDepositAmount(booking: Booking): string {
    return String(
      booking.deposit_amount ??
        getDefaultDepositAmount(booking.location, booking.size)
    );
  }

  function selectBooking(booking: Booking) {
    setSelectedBooking(booking);
    setEditingBooking(false);
    setBookingForm(buildBookingFormState(booking));
    setAdminNote(booking.admin_notes || "");
    setDepositAmount(getInitialDepositAmount(booking));
  }

  function closeBookingPanel() {
    setSelectedBooking(null);
    setEditingBooking(false);
    setBookingForm(null);
  }

  function updateBookingForm<Key extends keyof BookingFormState>(
    key: Key,
    value: BookingFormState[Key]
  ) {
    setBookingForm((current) => {
      if (!current) return current;

      if (key === "location") {
        const nextLocation = value as BookingLocation;
        return {
          ...current,
          location: nextLocation,
          preferred_dates: nextLocation === "malmo" ? "" : current.preferred_dates,
        };
      }

      return {
        ...current,
        [key]: value,
      };
    });
  }

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/admin/bookings${params}`);

      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }

      if (!res.ok) throw new Error("Failed to fetch bookings");

      const data = await res.json();
      setBookings(data.bookings);
      setError("");
    } catch {
      setError("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, router]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (!editingBooking || !selectedBooking) return;
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;

    const frame = window.requestAnimationFrame(() => {
      editSectionRef.current?.scrollIntoView({ block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [editingBooking, selectedBooking]);

  async function handleStatusUpdate(
    bookingId: string,
    newStatus: BookingStatus
  ) {
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const body: Record<string, unknown> = {
        id: bookingId,
        status: newStatus,
      };
      if (adminNote.trim()) body.admin_notes = adminNote.trim();
      if (depositAmount) body.deposit_amount = parseFloat(depositAmount);

      const res = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? data.booking : b))
      );
      selectBooking(data.booking);
      setSuccess(
        data.calendar_error
          ? `${getStatusSuccessMessage(newStatus)} Calendar sync may need manual attention.`
          : getStatusSuccessMessage(newStatus)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update booking");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveBookingEdits() {
    if (!selectedBooking || !bookingForm) return;

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedBooking.id,
          location: bookingForm.location,
          type: bookingForm.type,
          size: bookingForm.size,
          color: bookingForm.color,
          client_name: bookingForm.client_name,
          client_email: bookingForm.client_email,
          client_phone: bookingForm.client_phone.trim() || null,
          placement: bookingForm.placement,
          description: bookingForm.description,
          allergies: bookingForm.allergies.trim() || null,
          preferred_dates:
            bookingForm.location === "copenhagen"
              ? bookingForm.preferred_dates.trim() || null
              : null,
          ...(bookingForm.location === "copenhagen"
            ? {
                appointment_date: null,
                appointment_end: null,
              }
            : {}),
        }),
      });

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update booking details");
      }

      setBookings((prev) =>
        prev.map((booking) => (booking.id === selectedBooking.id ? data.booking : booking))
      );
      selectBooking(data.booking);
      setEditingBooking(false);
      setSuccess(
        data.calendar_error
          ? "Booking details updated, but calendar sync may need manual attention."
          : "Booking details updated."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update booking details");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteBooking(booking: Booking) {
    if (!confirm(`Delete ${booking.client_name}'s booking? This also removes its calendar link and stored reference images when possible.`)) {
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: booking.id,
          action: "delete",
        }),
      });

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete booking");
      }

      setBookings((prev) => prev.filter((item) => item.id !== booking.id));
      closeBookingPanel();
      setAdminNote("");
      setDepositAmount("");
      setSuccess(
        data.storage_warning
          ? "Booking deleted, but some reference images may still need manual cleanup."
          : "Booking deleted."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete booking");
    } finally {
      setActionLoading(false);
    }
  }

  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const depositPaidCount = bookings.filter((b) => b.status === "deposit_paid").length;

  // This week: bookings created from Monday 00:00 of the current week
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const thisWeekCount = bookings.filter(
    (b) => new Date(b.created_at) >= monday
  ).length;

  // This month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthCount = bookings.filter(
    (b) => new Date(b.created_at) >= monthStart
  ).length;

  // ── Traffic source breakdown ────────────────────────────
  function classifySource(b: Booking): string {
    if (b.utm_source) return b.utm_source;
    if (!b.referrer) return "Direct";
    try {
      const host = new URL(b.referrer).hostname.replace("www.", "");
      if (host.includes("instagram")) return "Instagram";
      if (host.includes("facebook") || host.includes("fb.")) return "Facebook";
      if (host.includes("google")) return "Google";
      if (host.includes("tiktok")) return "TikTok";
      return host;
    } catch {
      return "Other";
    }
  }

  const sourceCounts: Record<string, number> = {};
  for (const b of bookings) {
    const src = classifySource(b);
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }
  const sortedSources = Object.entries(sourceCounts).sort(
    ([, a], [, b]) => b - a
  );
  const statusActionsDisabled = actionLoading || editingBooking;

  return (
    <AdminShell
      title="Bookings"
      description="Review requests quickly, keep deposits visible, and move each tattoo from inquiry to confirmed session without admin headaches."
      activeTab="bookings"
      maxWidth="wide"
      actions={<AdminButton variant="secondary" onClick={fetchBookings}>Refresh</AdminButton>}
    >
      <div className="space-y-6">
        {error ? (
          <AdminAlert>
            {error}
            <button onClick={() => setError("")} className="ml-2 underline">
              dismiss
            </button>
          </AdminAlert>
        ) : null}

        {success ? <AdminAlert tone="info">{success}</AdminAlert> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard
            label="Pending"
            value={pendingCount}
            tone={pendingCount > 0 ? "warning" : "default"}
            detail="Needs a reply or a decision"
          />
          <AdminMetricCard
            label="Confirmed"
            value={depositPaidCount}
            tone={depositPaidCount > 0 ? "accent" : "default"}
            detail="Deposit already landed"
          />
          <AdminMetricCard label="This week" value={thisWeekCount} detail="New inquiries since Monday" />
          <AdminMetricCard label="This month" value={thisMonthCount} detail="New inquiries this month" />
        </div>

        <AdminSurface>
          <AdminSectionHeading
            title="Inbox filters"
            description="Sort the request queue fast, then open one request at a time without losing the broader picture."
            action={
              <span className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                {bookings.length} total requests
              </span>
            }
          />

          {sortedSources.length > 0 && bookings.length > 0 ? (
            <div className="rounded-2xl bg-[var(--sabbia-50)]/80 p-4 text-sm text-foreground-muted">
              <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                Traffic sources
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {sortedSources.map(([source, count]) => (
                  <span
                    key={source}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--sabbia-200)] bg-white px-3 py-1.5 text-xs text-foreground"
                  >
                    <span className="font-medium tabular-nums">{count}</span>
                    <span className="text-foreground-muted">{source}</span>
                    <span className="text-foreground-muted">
                      {Math.round((count / bookings.length) * 100)}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className={`flex gap-2 overflow-x-auto pb-1 ${sortedSources.length > 0 && bookings.length > 0 ? "mt-4" : ""}`}>
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setSelectedBooking(null);
                }}
                className={`inline-flex min-h-[36px] shrink-0 items-center rounded-full px-3 py-1.5 text-xs transition-colors ${
                  statusFilter === status
                    ? "bg-[var(--ink-900)] text-[var(--sabbia-50)]"
                    : "bg-[var(--sabbia-100)] text-foreground-muted hover:bg-[var(--sabbia-200)]"
                }`}
              >
                {status === "all" ? "All" : STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </AdminSurface>

        <div className="flex flex-col gap-6 lg:flex-row">
        {/* Booking list */}
        <AdminSurface className="flex-1 min-w-0">
          <AdminSectionHeading
            title={statusFilter === "all" ? "Requests" : STATUS_LABELS[statusFilter]}
            description={
              selectedBooking
                ? "Switch requests on the left while keeping the detail panel open."
                : "Pick a request to open the detail panel and keep the workflow moving."
            }
          />

          {loading ? (
            <AdminEmptyState
              title="Loading requests"
              description="Pulling the current booking queue so the next move is obvious."
            />
          ) : bookings.length === 0 ? (
            <AdminEmptyState
              title="No requests here"
              description="Try another status filter or wait for the next inquiry to land."
            />
          ) : (
            <div className="space-y-2">
              {bookings.map((booking) => (
                <button
                  key={booking.id}
                  onClick={() => selectBooking(booking)}
                  className={`w-full rounded-2xl border p-4 text-left shadow-sm transition-colors ${
                    selectedBooking?.id === booking.id
                      ? "border-[var(--trad-red-500)] bg-[var(--sabbia-50)]/80"
                      : "border-[var(--sabbia-200)] bg-white hover:border-[var(--sabbia-300)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {booking.client_name}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-foreground-muted">
                        <span className="rounded-full bg-[var(--sabbia-100)] px-2.5 py-1">
                          {TYPE_LABELS[booking.type] || booking.type}
                        </span>
                        <span className="rounded-full bg-[var(--sabbia-100)] px-2.5 py-1">
                          {LOCATION_LABELS[booking.location] || booking.location}
                        </span>
                        <span className="rounded-full bg-[var(--sabbia-100)] px-2.5 py-1">
                          {new Date(booking.created_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>

                      {booking.appointment_date ? (
                        <p className="mt-3 text-xs text-blue-600">
                          Session booked for{" "}
                          {new Date(booking.appointment_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          at{" "}
                          {new Date(booking.appointment_date).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${STATUS_COLORS[booking.status]}`}
                    >
                      {STATUS_LABELS[booking.status]}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </AdminSurface>

        {!selectedBooking ? (
          <div className="hidden shrink-0 lg:block lg:w-[400px]">
            <AdminEmptyState
              title="Open a request"
              description="Pick a booking from the list to review the brief, set notes, confirm the deposit, and move it forward."
            />
          </div>
        ) : null}

        {/* Detail panel — overlay on mobile, sidebar on desktop */}
        {selectedBooking ? (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/30 lg:hidden"
              onClick={closeBookingPanel}
            />
            <div className="fixed inset-x-0 bottom-0 top-12 z-50 overflow-y-auto bg-[var(--sabbia-50)] lg:static lg:inset-auto lg:z-auto lg:w-[400px] lg:shrink-0">
              <div className="relative min-h-full rounded-t-3xl border border-[var(--sabbia-200)] bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-6 lg:min-h-0 lg:rounded-3xl">
                <button
                  onClick={closeBookingPanel}
                  className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sabbia-100)] text-foreground-muted transition-colors hover:text-foreground lg:hidden"
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 1l12 12M13 1L1 13" />
                  </svg>
                </button>

                <div className="pr-12 lg:pr-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                    Request details
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.01em] text-ink-900">
                    {selectedBooking.client_name}
                  </h2>
                  <p className="mt-1 text-sm text-foreground-muted">
                    <a
                      href={`mailto:${selectedBooking.client_email}`}
                      className="transition-colors hover:text-[var(--trad-red-500)]"
                    >
                      {selectedBooking.client_email}
                    </a>
                    {selectedBooking.client_phone ? (
                      <>
                        {" "}
                        · {" "}
                        <a
                          href={`tel:${selectedBooking.client_phone}`}
                          className="transition-colors hover:text-[var(--trad-red-500)]"
                        >
                          {selectedBooking.client_phone}
                        </a>
                      </>
                    ) : null}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_COLORS[selectedBooking.status]}`}>
                      {STATUS_LABELS[selectedBooking.status]}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      Received{" "}
                      {new Date(selectedBooking.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="rounded-full bg-[var(--sabbia-100)] px-2.5 py-1 font-mono text-[11px] text-foreground-muted">
                      {selectedBooking.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-[var(--sabbia-50)]/80 p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-foreground-muted">Location</p>
                      <p className="mt-1 text-foreground">
                        {LOCATION_LABELS[selectedBooking.location] || selectedBooking.location}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-foreground-muted">Type</p>
                      <p className="mt-1 text-foreground">
                        {TYPE_LABELS[selectedBooking.type] || selectedBooking.type}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-foreground-muted">Size</p>
                      <p className="mt-1 text-foreground">
                        {SIZE_LABELS[selectedBooking.size] || selectedBooking.size}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-foreground-muted">Color</p>
                      <p className="mt-1 text-foreground">
                        {COLOR_LABELS[selectedBooking.color] || selectedBooking.color}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {(selectedBooking.placement || selectedBooking.description || selectedBooking.allergies || selectedBooking.preferred_dates) ? (
                    <div className="rounded-2xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                        Tattoo brief
                      </p>

                      {selectedBooking.placement ? (
                        <div className="mt-3 text-sm">
                          <p className="text-xs text-foreground-muted">Placement</p>
                          <p className="mt-1 text-foreground">{selectedBooking.placement}</p>
                        </div>
                      ) : null}

                      {selectedBooking.description ? (
                        <div className="mt-3 text-sm">
                          <p className="text-xs text-foreground-muted">Description</p>
                          <p className="mt-1 whitespace-pre-wrap text-foreground">
                            {selectedBooking.description}
                          </p>
                        </div>
                      ) : null}

                      {selectedBooking.allergies ? (
                        <div className="mt-3 text-sm">
                          <p className="text-xs text-foreground-muted">Allergies</p>
                          <p className="mt-1 text-red-700">{selectedBooking.allergies}</p>
                        </div>
                      ) : null}

                      {selectedBooking.preferred_dates ? (
                        <div className="mt-3 text-sm">
                          <p className="text-xs text-foreground-muted">Preferred dates</p>
                          <p className="mt-1 whitespace-pre-wrap text-foreground">
                            {selectedBooking.preferred_dates}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {(selectedBooking.deposit_amount !== null || selectedBooking.appointment_date || selectedBooking.admin_notes || selectedBooking.referrer || selectedBooking.utm_source) ? (
                    <div className="rounded-2xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                        Operations
                      </p>

                      {selectedBooking.deposit_amount !== null && selectedBooking.status !== "pending" ? (
                        <div className="mt-3 text-sm">
                          <p className="text-xs text-foreground-muted">Deposit</p>
                          <p className="mt-1 text-foreground">
                            {selectedBooking.deposit_amount} {getDepositCurrency(selectedBooking.location)}
                          </p>
                        </div>
                      ) : null}

                      {selectedBooking.appointment_date ? (
                        <div className="mt-3 text-sm">
                          <p className="text-xs text-foreground-muted">Appointment</p>
                          <p className="mt-1 text-foreground">
                            {new Date(selectedBooking.appointment_date).toLocaleDateString("en-GB", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                            {" at "}
                            {new Date(selectedBooking.appointment_date).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {selectedBooking.appointment_end ? (
                              <>
                                {" – "}
                                {new Date(selectedBooking.appointment_end).toLocaleTimeString("en-GB", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </>
                            ) : null}
                          </p>
                          {selectedBooking.calendar_event_id ? (
                            <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                              Synced to Google Calendar
                            </p>
                          ) : selectedBooking.status === "deposit_paid" ? (
                            <p className="mt-1 flex items-center gap-1 text-xs text-yellow-600">
                              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
                              Calendar event pending
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {(selectedBooking.referrer || selectedBooking.utm_source) ? (
                        <div className="mt-3 text-sm">
                          <p className="text-xs text-foreground-muted">Came from</p>
                          <p className="mt-1 text-foreground">
                            {classifySource(selectedBooking)}
                            {selectedBooking.utm_campaign ? (
                              <span className="ml-1 text-xs text-foreground-muted">
                                ({selectedBooking.utm_campaign})
                              </span>
                            ) : null}
                          </p>
                        </div>
                      ) : null}

                      {selectedBooking.admin_notes && selectedBooking.status !== "pending" ? (
                        <div className="mt-3 text-sm">
                          <p className="text-xs text-foreground-muted">Your notes</p>
                          <p className="mt-1 italic text-foreground">{selectedBooking.admin_notes}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {!editingBooking ? (
                    <AdminButton
                      variant="secondary"
                      disabled={actionLoading}
                      onClick={() => {
                        setEditingBooking(true);
                        setBookingForm(buildBookingFormState(selectedBooking));
                      }}
                    >
                      Edit request details
                    </AdminButton>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleDeleteBooking(selectedBooking)}
                    disabled={actionLoading}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-red-200 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete booking
                  </button>
                </div>

                {editingBooking && bookingForm ? (
                  <div
                    ref={editSectionRef}
                    className="mt-5 rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                      Edit request details
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs text-foreground-muted">
                        Client name
                        <input
                          value={bookingForm.client_name}
                          onChange={(event) => updateBookingForm("client_name", event.target.value)}
                          className={BOOKING_CONTROL_CLASSNAME}
                          style={{ fontSize: "16px" }}
                        />
                      </label>

                      <label className="text-xs text-foreground-muted">
                        Client email
                        <input
                          type="email"
                          value={bookingForm.client_email}
                          onChange={(event) => updateBookingForm("client_email", event.target.value)}
                          className={BOOKING_CONTROL_CLASSNAME}
                          style={{ fontSize: "16px" }}
                        />
                      </label>

                      <label className="text-xs text-foreground-muted">
                        Client phone
                        <input
                          value={bookingForm.client_phone}
                          onChange={(event) => updateBookingForm("client_phone", event.target.value)}
                          className={BOOKING_CONTROL_CLASSNAME}
                          style={{ fontSize: "16px" }}
                        />
                      </label>

                      <label className="text-xs text-foreground-muted">
                        Location
                        <select
                          value={bookingForm.location}
                          onChange={(event) =>
                            updateBookingForm("location", event.target.value as BookingLocation)
                          }
                          className={BOOKING_CONTROL_CLASSNAME}
                          style={{ fontSize: "16px" }}
                        >
                          {(["malmo", "copenhagen"] as const).map((location) => (
                            <option key={location} value={location}>
                              {LOCATION_LABELS[location]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs text-foreground-muted">
                        Type
                        <select
                          value={bookingForm.type}
                          onChange={(event) =>
                            updateBookingForm("type", event.target.value as BookingType)
                          }
                          className={BOOKING_CONTROL_CLASSNAME}
                          style={{ fontSize: "16px" }}
                        >
                          {(["flash", "custom", "consultation", "coverup", "rework"] as const).map((type) => (
                            <option key={type} value={type}>
                              {TYPE_LABELS[type]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs text-foreground-muted">
                        Size
                        <select
                          value={bookingForm.size}
                          onChange={(event) =>
                            updateBookingForm("size", event.target.value as BookingSize)
                          }
                          className={BOOKING_CONTROL_CLASSNAME}
                          style={{ fontSize: "16px" }}
                        >
                          {(["small", "medium", "large", "xlarge"] as const).map((size) => (
                            <option key={size} value={size}>
                              {SIZE_LABELS[size]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs text-foreground-muted sm:col-span-2">
                        Color
                        <select
                          value={bookingForm.color}
                          onChange={(event) =>
                            updateBookingForm("color", event.target.value as ColorPreference)
                          }
                          className={BOOKING_CONTROL_CLASSNAME}
                          style={{ fontSize: "16px" }}
                        >
                          {(["blackgrey", "color", "both"] as const).map((color) => (
                            <option key={color} value={color}>
                              {COLOR_LABELS[color]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3">
                      <label className="text-xs text-foreground-muted">
                        Placement
                        <input
                          value={bookingForm.placement}
                          onChange={(event) => updateBookingForm("placement", event.target.value)}
                          className={BOOKING_CONTROL_CLASSNAME}
                          style={{ fontSize: "16px" }}
                        />
                      </label>

                      <label className="text-xs text-foreground-muted">
                        Description
                        <textarea
                          value={bookingForm.description}
                          onChange={(event) => updateBookingForm("description", event.target.value)}
                          rows={5}
                          className={BOOKING_TEXTAREA_CLASSNAME}
                          style={{ fontSize: "16px" }}
                        />
                      </label>

                      <label className="text-xs text-foreground-muted">
                        Allergies
                        <input
                          value={bookingForm.allergies}
                          onChange={(event) => updateBookingForm("allergies", event.target.value)}
                          className={BOOKING_CONTROL_CLASSNAME}
                          style={{ fontSize: "16px" }}
                        />
                      </label>

                      {bookingForm.location === "copenhagen" ? (
                        <label className="text-xs text-foreground-muted">
                          Preferred dates
                          <textarea
                            value={bookingForm.preferred_dates}
                            onChange={(event) => updateBookingForm("preferred_dates", event.target.value)}
                            rows={4}
                            className={BOOKING_TEXTAREA_CLASSNAME}
                            style={{ fontSize: "16px" }}
                          />
                        </label>
                      ) : null}
                    </div>

                    {selectedBooking.location !== bookingForm.location && selectedBooking.calendar_event_id ? (
                      <p className="mt-3 text-[11px] leading-relaxed text-foreground-muted">
                        Changing this booking away from Malmö resident slots will remove its synced Google Calendar event on save.
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <AdminButton
                        variant="primary"
                        disabled={actionLoading}
                        onClick={handleSaveBookingEdits}
                      >
                        {actionLoading ? "Saving..." : "Save request changes"}
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        disabled={actionLoading}
                        onClick={() => {
                          setEditingBooking(false);
                          setBookingForm(buildBookingFormState(selectedBooking));
                        }}
                      >
                        Cancel
                      </AdminButton>
                    </div>
                  </div>
                ) : null}

                {selectedBooking.status === "pending" ? (
                  <div className="mt-5 rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                      Decision helper
                    </p>

                    <div className="mt-4 space-y-3">
                      <label className="block text-xs text-foreground-muted">
                        Note for client (optional)
                        <textarea
                          value={adminNote}
                          onChange={(event) => setAdminNote(event.target.value)}
                          rows={4}
                          className={BOOKING_TEXTAREA_CLASSNAME}
                          style={{ fontSize: "16px" }}
                          placeholder="Add a personal note..."
                        />
                      </label>

                      <label className="block text-xs text-foreground-muted">
                        Deposit amount ({getDepositCurrency(bookingForm?.location ?? selectedBooking.location)})
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={(event) => setDepositAmount(event.target.value)}
                          className={BOOKING_CONTROL_CLASSNAME}
                          style={{ fontSize: "16px" }}
                          placeholder={String(
                            getDefaultDepositAmount(
                              bookingForm?.location ?? selectedBooking.location,
                              bookingForm?.size ?? selectedBooking.size
                            )
                          )}
                        />
                        <span className="mt-1 block text-[11px] text-foreground-muted">
                          Pre-filled from size and location. Override it only when the real quote differs.
                        </span>
                      </label>
                    </div>
                  </div>
                ) : null}

                {editingBooking ? (
                  <p className="mt-4 text-[11px] leading-relaxed text-foreground-muted">
                    Save or cancel the request edits before changing the booking status.
                  </p>
                ) : null}

                <div className="mt-5 space-y-2">
                  {selectedBooking.status === "pending" ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(selectedBooking.id, "approved")}
                        disabled={statusActionsDisabled}
                        className={`${STATUS_ACTION_BUTTON_CLASSNAME} bg-emerald-600 hover:bg-emerald-700`}
                      >
                        {actionLoading ? "Working..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(selectedBooking.id, "declined")}
                        disabled={statusActionsDisabled}
                        className={`${STATUS_ACTION_BUTTON_CLASSNAME} bg-red-600 hover:bg-red-700`}
                      >
                        {actionLoading ? "Working..." : "Decline"}
                      </button>
                    </div>
                  ) : null}

                  {selectedBooking.status === "approved" ? (
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(selectedBooking.id, "deposit_paid")}
                      disabled={statusActionsDisabled}
                      className={`${STATUS_ACTION_BUTTON_CLASSNAME} bg-blue-600 hover:bg-blue-700`}
                    >
                      {actionLoading ? "Working..." : "Mark deposit paid"}
                    </button>
                  ) : null}

                  {(selectedBooking.status === "deposit_paid" || selectedBooking.status === "approved") ? (
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(selectedBooking.id, "completed")}
                      disabled={statusActionsDisabled}
                      className={`${STATUS_ACTION_BUTTON_CLASSNAME} bg-purple-600 hover:bg-purple-700`}
                    >
                      {actionLoading ? "Working..." : "Mark completed and send aftercare"}
                    </button>
                  ) : null}

                  {selectedBooking.status !== "cancelled" &&
                  selectedBooking.status !== "completed" &&
                  selectedBooking.status !== "declined" ? (
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(selectedBooking.id, "cancelled")}
                      disabled={statusActionsDisabled}
                      className={NEUTRAL_ACTION_BUTTON_CLASSNAME}
                    >
                      Cancel booking
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
