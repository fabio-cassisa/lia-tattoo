"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getDefaultDepositAmount,
  getDepositCurrency,
} from "@/lib/bookings/deposit";
import {
  AdminShell,
  AdminMetricCard,
  AdminSurface,
} from "@/components/admin/AdminShell";
import { AdminAlert, AdminButton } from "@/components/admin/AdminPrimitives";
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
  malmo: "Malmö",
  copenhagen: "Copenhagen",
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

        // Update local state
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

      {/* Error */}
      {error && (
        <div className="mb-4">
          <AdminAlert>
            {error}
            <button onClick={() => setError("")} className="ml-2 underline">
              dismiss
            </button>
          </AdminAlert>
        </div>
      )}

      {success && (
        <div className="mb-4">
          <AdminAlert tone="info">{success}</AdminAlert>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 sm:mb-6">
        <AdminMetricCard label="Pending" value={pendingCount} tone={pendingCount > 0 ? "warning" : "default"} />
        <AdminMetricCard label="Confirmed" value={depositPaidCount} tone={depositPaidCount > 0 ? "accent" : "default"} />
        <AdminMetricCard label="This week" value={thisWeekCount} />
        <AdminMetricCard label="This month" value={thisMonthCount} />
      </div>

      {/* Traffic sources */}
      {sortedSources.length > 0 && bookings.length > 0 && (
        <AdminSurface className="mb-4 sm:mb-6">
          <p className="text-xs text-foreground-muted mb-2">Traffic sources</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {sortedSources.map(([source, count]) => (
              <div key={source} className="flex items-center gap-1.5 text-sm">
                <span className="font-medium text-foreground tabular-nums">{count}</span>
                <span className="text-foreground-muted text-xs">{source}</span>
                <span className="text-foreground-muted text-[10px]">
                  ({Math.round((count / bookings.length) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </AdminSurface>
      )}

      {/* Refresh row */}
      <div className="flex items-center justify-between mb-4 text-sm text-foreground-muted">
        <span>{bookings.length} total bookings</span>
        <span>Tap a request to open the detail panel</span>
      </div>

      {/* Status filter tabs — horizontally scrollable on mobile */}
      <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
        {(
          ["all", "pending", "approved", "deposit_paid", "completed", "declined", "cancelled"] as const
        ).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              setSelectedBooking(null);
            }}
            className={`shrink-0 px-3 py-1.5 text-xs rounded-full transition-colors min-h-[36px] ${
              statusFilter === s
                ? "bg-[var(--ink-900)] text-[var(--sabbia-50)]"
                : "bg-[var(--sabbia-100)] text-foreground-muted hover:bg-[var(--sabbia-200)]"
            }`}
          >
            {s === "all" ? "All" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Main content: list + detail */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Booking list */}
        <AdminSurface className="flex-1 min-w-0">
          {loading ? (
            <p className="text-sm text-foreground-muted py-8 text-center">
              Loading...
            </p>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-foreground-muted py-8 text-center">
              No bookings found.
            </p>
          ) : (
            <div className="space-y-2">
              {bookings.map((booking) => (
                <button
                  key={booking.id}
                  onClick={() => selectBooking(booking)}
                  className={`w-full text-left p-4 rounded border transition-colors ${
                    selectedBooking?.id === booking.id
                      ? "border-[var(--trad-red-500)] bg-white"
                      : "border-[var(--sabbia-200)] bg-white hover:border-[var(--sabbia-300)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {booking.client_name}
                      </p>
                      <p className="text-xs text-foreground-muted mt-0.5">
                        {TYPE_LABELS[booking.type] || booking.type} &middot;{" "}
                        {LOCATION_LABELS[booking.location] || booking.location} &middot;{" "}
                        {new Date(booking.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                        {booking.appointment_date && (
                          <>
                            {" "}
                            &middot;{" "}
                            <span className="text-blue-600">
                              {new Date(booking.appointment_date).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })}{" "}
                              {new Date(booking.appointment_date).toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[booking.status]}`}
                    >
                      {STATUS_LABELS[booking.status]}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </AdminSurface>

        {/* Detail panel — overlay on mobile, sidebar on desktop */}
        {selectedBooking && (
          <>
            {/* Mobile overlay backdrop */}
              <div
                className="fixed inset-0 bg-black/30 z-40 lg:hidden"
                onClick={closeBookingPanel}
              />
              <div className="fixed inset-x-0 bottom-0 top-12 z-50 overflow-y-auto bg-[var(--sabbia-50)] lg:static lg:inset-auto lg:z-auto lg:w-[400px] shrink-0">
                <div className="bg-white border border-[var(--sabbia-200)] rounded-t-xl lg:rounded p-5 lg:sticky lg:top-6 min-h-full lg:min-h-0">
                  {/* Close button — mobile only */}
                  <button
                    onClick={closeBookingPanel}
                    className="lg:hidden absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-foreground-muted hover:text-foreground rounded-full bg-[var(--sabbia-100)]"
                    aria-label="Close"
                  >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 1l12 12M13 1L1 13" />
                  </svg>
                </button>
              {/* Client info */}
              <div className="mb-4">
                <h2 className="text-base font-medium text-foreground">
                  {selectedBooking.client_name}
                </h2>
                <p className="text-xs text-foreground-muted mt-1">
                  <a
                    href={`mailto:${selectedBooking.client_email}`}
                    className="hover:text-[var(--trad-red-500)] transition-colors"
                  >
                    {selectedBooking.client_email}
                  </a>
                  {selectedBooking.client_phone && (
                    <>
                      {" "}
                      &middot;{" "}
                      <a
                        href={`tel:${selectedBooking.client_phone}`}
                        className="hover:text-[var(--trad-red-500)] transition-colors"
                      >
                        {selectedBooking.client_phone}
                      </a>
                    </>
                  )}
                </p>
              </div>

              {/* Status badge */}
              <div className="mb-4">
                <span
                  className={`inline-block px-2.5 py-1 text-xs rounded-full ${STATUS_COLORS[selectedBooking.status]}`}
                >
                  {STATUS_LABELS[selectedBooking.status]}
                </span>
                <span className="text-xs text-foreground-muted ml-2">
                  {new Date(selectedBooking.created_at).toLocaleDateString(
                    "en-GB",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                </span>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-4">
                <div>
                  <p className="text-xs text-foreground-muted">Location</p>
                  <p className="text-foreground">
                    {LOCATION_LABELS[selectedBooking.location] ||
                      selectedBooking.location}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Type</p>
                  <p className="text-foreground">
                    {TYPE_LABELS[selectedBooking.type] || selectedBooking.type}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Size</p>
                  <p className="text-foreground">
                    {SIZE_LABELS[selectedBooking.size] || selectedBooking.size}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Color</p>
                  <p className="text-foreground">
                    {COLOR_LABELS[selectedBooking.color] ||
                      selectedBooking.color}
                  </p>
                </div>
              </div>

              {/* Placement */}
              {selectedBooking.placement && (
                <div className="mb-3 text-sm">
                  <p className="text-xs text-foreground-muted">Placement</p>
                  <p className="text-foreground">{selectedBooking.placement}</p>
                </div>
              )}

              {/* Description */}
              {selectedBooking.description && (
                <div className="mb-3 text-sm">
                  <p className="text-xs text-foreground-muted">Description</p>
                  <p className="text-foreground whitespace-pre-wrap">
                    {selectedBooking.description}
                  </p>
                </div>
              )}

              {/* Allergies */}
              {selectedBooking.allergies && (
                <div className="mb-3 text-sm">
                  <p className="text-xs text-foreground-muted">Allergies</p>
                  <p className="text-red-700">{selectedBooking.allergies}</p>
                </div>
              )}

              {/* Admin notes (existing) */}
              {selectedBooking.admin_notes && selectedBooking.status !== "pending" && (
                <div className="mb-3 text-sm">
                  <p className="text-xs text-foreground-muted">Your notes</p>
                  <p className="text-foreground italic">
                    {selectedBooking.admin_notes}
                  </p>
                </div>
              )}

              {/* Deposit info */}
              {selectedBooking.deposit_amount !== null &&
                selectedBooking.status !== "pending" && (
                <div className="mb-3 text-sm">
                  <p className="text-xs text-foreground-muted">Deposit</p>
                  <p className="text-foreground">
                    {selectedBooking.deposit_amount}{" "}
                    {getDepositCurrency(selectedBooking.location)}
                  </p>
                </div>
              )}

              {/* Appointment date/time (Malmö — slot picker) */}
              {selectedBooking.appointment_date && (
                <div className="mb-3 text-sm">
                  <p className="text-xs text-foreground-muted">Appointment</p>
                  <p className="text-foreground">
                    {new Date(
                      selectedBooking.appointment_date
                    ).toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {" at "}
                    {new Date(
                      selectedBooking.appointment_date
                    ).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {selectedBooking.appointment_end && (
                      <>
                        {" – "}
                        {new Date(
                          selectedBooking.appointment_end
                        ).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </p>
                  {/* Calendar sync indicator */}
                  {selectedBooking.calendar_event_id ? (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                      Synced to Google Calendar
                    </p>
                  ) : selectedBooking.status === "deposit_paid" ? (
                    <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
                      Calendar event pending
                    </p>
                  ) : null}
                </div>
              )}

              {/* Preferred dates (Copenhagen — free text) */}
              {selectedBooking.preferred_dates && (
                <div className="mb-3 text-sm">
                  <p className="text-xs text-foreground-muted">Preferred dates</p>
                  <p className="text-foreground whitespace-pre-wrap">
                    {selectedBooking.preferred_dates}
                  </p>
                </div>
              )}

              {/* Referral source */}
              {(selectedBooking.referrer || selectedBooking.utm_source) && (
                <div className="mb-3 text-sm">
                  <p className="text-xs text-foreground-muted">Came from</p>
                  <p className="text-foreground">
                    {classifySource(selectedBooking)}
                    {selectedBooking.utm_campaign && (
                      <span className="text-foreground-muted text-xs ml-1">
                        ({selectedBooking.utm_campaign})
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Divider */}
              <hr className="my-4 border-[var(--sabbia-200)]" />

              <div className="mb-4 flex flex-wrap gap-2">
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
                <div className="mb-4 rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                    Edit request details
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-foreground-muted">
                      Client name
                      <input
                        value={bookingForm.client_name}
                        onChange={(event) => updateBookingForm("client_name", event.target.value)}
                        className="mt-1 w-full rounded border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                        style={{ fontSize: "16px" }}
                      />
                    </label>

                    <label className="text-xs text-foreground-muted">
                      Client email
                      <input
                        type="email"
                        value={bookingForm.client_email}
                        onChange={(event) => updateBookingForm("client_email", event.target.value)}
                        className="mt-1 w-full rounded border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                        style={{ fontSize: "16px" }}
                      />
                    </label>

                    <label className="text-xs text-foreground-muted">
                      Client phone
                      <input
                        value={bookingForm.client_phone}
                        onChange={(event) => updateBookingForm("client_phone", event.target.value)}
                        className="mt-1 w-full rounded border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
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
                        className="mt-1 w-full rounded border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
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
                        className="mt-1 w-full rounded border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
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
                        className="mt-1 w-full rounded border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                        style={{ fontSize: "16px" }}
                      >
                        {(["small", "medium", "large", "xlarge"] as const).map((size) => (
                          <option key={size} value={size}>
                            {SIZE_LABELS[size]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs text-foreground-muted">
                      Color
                      <select
                        value={bookingForm.color}
                        onChange={(event) =>
                          updateBookingForm("color", event.target.value as ColorPreference)
                        }
                        className="mt-1 w-full rounded border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
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
                        className="mt-1 w-full rounded border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                        style={{ fontSize: "16px" }}
                      />
                    </label>

                    <label className="text-xs text-foreground-muted">
                      Description
                      <textarea
                        value={bookingForm.description}
                        onChange={(event) => updateBookingForm("description", event.target.value)}
                        rows={4}
                        className="mt-1 w-full rounded border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                        style={{ fontSize: "16px" }}
                      />
                    </label>

                    <label className="text-xs text-foreground-muted">
                      Allergies
                      <input
                        value={bookingForm.allergies}
                        onChange={(event) => updateBookingForm("allergies", event.target.value)}
                        className="mt-1 w-full rounded border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                        style={{ fontSize: "16px" }}
                      />
                    </label>

                    {bookingForm.location === "copenhagen" ? (
                      <label className="text-xs text-foreground-muted">
                        Preferred dates
                        <textarea
                          value={bookingForm.preferred_dates}
                          onChange={(event) => updateBookingForm("preferred_dates", event.target.value)}
                          rows={3}
                          className="mt-1 w-full rounded border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                          style={{ fontSize: "16px" }}
                        />
                      </label>
                    ) : null}
                  </div>

                  {selectedBooking.location !== bookingForm.location && selectedBooking.calendar_event_id ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-foreground-muted">
                      Changing this booking away from Malmö will remove its synced Google Calendar event on save.
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

              {/* Approval inputs */}
              {selectedBooking.status === "pending" && (
                <div className="mb-4 space-y-3">
                  <div>
                    <label className="block text-xs text-foreground-muted mb-1">
                      Note for client (optional)
                    </label>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-[var(--sabbia-200)] rounded text-sm bg-white text-foreground focus:outline-none focus:border-[var(--trad-red-500)]"
                      style={{ fontSize: "16px" }}
                      placeholder="Add a personal note..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-foreground-muted mb-1">
                      Deposit amount ({getDepositCurrency(bookingForm?.location ?? selectedBooking.location)})
                    </label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--sabbia-200)] rounded text-sm bg-white text-foreground focus:outline-none focus:border-[var(--trad-red-500)]"
                      style={{ fontSize: "16px" }}
                        placeholder={String(
                          getDefaultDepositAmount(
                            bookingForm?.location ?? selectedBooking.location,
                            bookingForm?.size ?? selectedBooking.size
                          )
                        )}
                    />
                    <p className="mt-1 text-[11px] text-foreground-muted">
                      Pre-filled from size and location. Override it if needed
                      before approving.
                    </p>
                  </div>
                </div>
              )}

              {editingBooking ? (
                <p className="mb-4 text-[11px] leading-relaxed text-foreground-muted">
                  Save or cancel the request edits before changing the booking status.
                </p>
              ) : null}

              {/* Action buttons based on status */}
              <div className="space-y-2">
                {selectedBooking.status === "pending" && (
                  <>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleStatusUpdate(selectedBooking.id, "approved")
                        }
                        disabled={statusActionsDisabled}
                        className="flex-1 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() =>
                          handleStatusUpdate(selectedBooking.id, "declined")
                        }
                        disabled={statusActionsDisabled}
                        className="flex-1 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading ? "..." : "Decline"}
                      </button>
                    </div>
                  </>
                )}

                {selectedBooking.status === "approved" && (
                  <button
                    onClick={() =>
                      handleStatusUpdate(selectedBooking.id, "deposit_paid")
                    }
                    disabled={statusActionsDisabled}
                    className="w-full py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? "..." : "Mark Deposit Paid"}
                  </button>
                )}

                {(selectedBooking.status === "deposit_paid" ||
                  selectedBooking.status === "approved") && (
                  <button
                    onClick={() =>
                      handleStatusUpdate(selectedBooking.id, "completed")
                    }
                    disabled={statusActionsDisabled}
                    className="w-full py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? "..." : "Mark Completed (sends aftercare email)"}
                  </button>
                )}

                {selectedBooking.status !== "cancelled" &&
                  selectedBooking.status !== "completed" &&
                  selectedBooking.status !== "declined" && (
                    <button
                      onClick={() =>
                        handleStatusUpdate(selectedBooking.id, "cancelled")
                      }
                      disabled={statusActionsDisabled}
                      className="w-full py-2 text-sm border border-gray-300 text-gray-500 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Cancel booking
                    </button>
                  )}
              </div>

              {/* Booking ID */}
              <p className="mt-4 text-xs text-foreground-muted text-center font-mono">
                {selectedBooking.id.slice(0, 8)}
              </p>
            </div>
          </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
