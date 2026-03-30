"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────
type BookingStatus =
  | "pending"
  | "approved"
  | "declined"
  | "deposit_paid"
  | "completed"
  | "cancelled";

type Booking = {
  id: string;
  created_at: string;
  updated_at: string;
  status: BookingStatus;
  location: string;
  type: string;
  description: string;
  placement: string;
  size: string;
  color: string;
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

// ── Admin Dashboard ──────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [showNoteField, setShowNoteField] = useState(false);

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

      if (!res.ok) throw new Error("Update failed");

      const data = await res.json();
      // Update local state
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? data.booking : b))
      );
      setSelectedBooking(data.booking);
      setAdminNote("");
      setDepositAmount("");
      setShowNoteField(false);
    } catch {
      setError("Failed to update booking");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-base sm:text-lg tracking-wider text-foreground">
            liagiorgi.one.ttt
          </h1>
          <p className="text-[10px] sm:text-xs text-foreground-muted tracking-wider uppercase">
            Booking Dashboard
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-foreground-muted hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-end"
        >
          Sign out
        </button>
      </div>

      {/* Admin nav */}
      <div className="flex gap-2 mb-4 sm:mb-6">
        <span className="px-3 py-1.5 text-xs rounded-full bg-[var(--ink-900)] text-[var(--sabbia-50)]">
          Bookings
        </span>
        <a
          href="/admin/portfolio"
          className="px-3 py-1.5 text-xs rounded-full bg-[var(--sabbia-100)] text-foreground-muted hover:bg-[var(--sabbia-200)] transition-colors"
        >
          Portfolio
        </a>
        <a
          href="/admin/insights"
          className="px-3 py-1.5 text-xs rounded-full bg-[var(--sabbia-100)] text-foreground-muted hover:bg-[var(--sabbia-200)] transition-colors"
        >
          Creative Coach
        </a>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 sm:mb-6">
        <div className="bg-white border border-[var(--sabbia-200)] rounded p-3">
          <p className="text-xs text-foreground-muted">Pending</p>
          <p className={`text-xl font-medium tabular-nums ${pendingCount > 0 ? "text-yellow-700" : "text-foreground"}`}>
            {pendingCount}
          </p>
        </div>
        <div className="bg-white border border-[var(--sabbia-200)] rounded p-3">
          <p className="text-xs text-foreground-muted">Confirmed</p>
          <p className={`text-xl font-medium tabular-nums ${depositPaidCount > 0 ? "text-blue-700" : "text-foreground"}`}>
            {depositPaidCount}
          </p>
        </div>
        <div className="bg-white border border-[var(--sabbia-200)] rounded p-3">
          <p className="text-xs text-foreground-muted">This week</p>
          <p className="text-xl font-medium tabular-nums text-foreground">{thisWeekCount}</p>
        </div>
        <div className="bg-white border border-[var(--sabbia-200)] rounded p-3">
          <p className="text-xs text-foreground-muted">This month</p>
          <p className="text-xl font-medium tabular-nums text-foreground">{thisMonthCount}</p>
        </div>
      </div>

      {/* Traffic sources */}
      {sortedSources.length > 0 && bookings.length > 0 && (
        <div className="bg-white border border-[var(--sabbia-200)] rounded p-3 mb-4 sm:mb-6">
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
        </div>
      )}

      {/* Refresh row */}
      <div className="flex items-center justify-between mb-4 text-sm text-foreground-muted">
        <span>{bookings.length} total bookings</span>
        <button
          onClick={fetchBookings}
          className="text-xs hover:text-foreground transition-colors"
        >
          Refresh
        </button>
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
        <div className="flex-1 min-w-0">
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
                  onClick={() => {
                    setSelectedBooking(booking);
                    setShowNoteField(false);
                    setAdminNote(booking.admin_notes || "");
                  }}
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
        </div>

        {/* Detail panel — overlay on mobile, sidebar on desktop */}
        {selectedBooking && (
          <>
            {/* Mobile overlay backdrop */}
            <div
              className="fixed inset-0 bg-black/30 z-40 lg:hidden"
              onClick={() => setSelectedBooking(null)}
            />
            <div className="fixed inset-x-0 bottom-0 top-12 z-50 overflow-y-auto bg-[var(--sabbia-50)] lg:static lg:inset-auto lg:z-auto lg:w-[400px] shrink-0">
              <div className="bg-white border border-[var(--sabbia-200)] rounded-t-xl lg:rounded p-5 lg:sticky lg:top-6 min-h-full lg:min-h-0">
                {/* Close button — mobile only */}
                <button
                  onClick={() => setSelectedBooking(null)}
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
              {selectedBooking.admin_notes && !showNoteField && (
                <div className="mb-3 text-sm">
                  <p className="text-xs text-foreground-muted">Your notes</p>
                  <p className="text-foreground italic">
                    {selectedBooking.admin_notes}
                  </p>
                </div>
              )}

              {/* Deposit info */}
              {selectedBooking.deposit_amount && (
                <div className="mb-3 text-sm">
                  <p className="text-xs text-foreground-muted">Deposit</p>
                  <p className="text-foreground">
                    {selectedBooking.deposit_amount}{" "}
                    {selectedBooking.location === "copenhagen" ? "DKK" : "SEK"}
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

              {/* Note + deposit input (toggled) */}
              {showNoteField && (
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
                  {selectedBooking.status === "pending" && (
                    <div>
                      <label className="block text-xs text-foreground-muted mb-1">
                        Deposit amount ({selectedBooking?.location === "copenhagen" ? "DKK" : "SEK"})
                      </label>
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--sabbia-200)] rounded text-sm bg-white text-foreground focus:outline-none focus:border-[var(--trad-red-500)]"
                        style={{ fontSize: "16px" }}
                        placeholder="300 or 500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons based on status */}
              <div className="space-y-2">
                {selectedBooking.status === "pending" && (
                  <>
                    {!showNoteField ? (
                      <button
                        onClick={() => setShowNoteField(true)}
                        className="w-full py-2 text-sm border border-[var(--sabbia-200)] rounded text-foreground-muted hover:border-[var(--sabbia-300)] transition-colors"
                      >
                        Add note / deposit amount
                      </button>
                    ) : null}
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleStatusUpdate(selectedBooking.id, "approved")
                        }
                        disabled={actionLoading}
                        className="flex-1 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() =>
                          handleStatusUpdate(selectedBooking.id, "declined")
                        }
                        disabled={actionLoading}
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
                    disabled={actionLoading}
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
                    disabled={actionLoading}
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
                      disabled={actionLoading}
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
    </div>
  );
}
