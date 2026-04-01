"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminShell,
  AdminSurface,
  AdminMetricCard,
  AdminEmptyState,
} from "@/components/admin/AdminShell";
import {
  AdminAlert,
  AdminButton,
  AdminSectionHeading,
} from "@/components/admin/AdminPrimitives";
import {
  FINANCE_CURRENCY_OPTIONS,
  FINANCE_PAYMENT_METHOD_LABELS,
  FINANCE_PAYMENT_METHOD_OPTIONS,
  FINANCE_WORK_CONTEXT_OPTIONS,
  getContextCurrencyDefault,
  getContextFeeDefault,
  getContextLabel,
} from "@/lib/finance/config";
import { getPreviousMonthKey, normalizeMonthKey } from "@/lib/finance/reporting";
import type {
  FinanceCurrency,
  FinancePaymentMethod,
  FinanceWorkContext,
} from "@/lib/supabase/database.types";
import type {
  FinanceDashboardResponse,
  FinanceProjectWithPayments,
} from "@/lib/finance/types";

type FinanceFormState = {
  booking_id: string;
  client_name: string;
  project_label: string;
  session_date: string;
  work_context: FinanceWorkContext;
  payment_label: string;
  payment_date: string;
  gross_amount: string;
  currency: FinanceCurrency;
  payment_method: FinancePaymentMethod;
  fee_percentage: string;
  invoice_needed: boolean;
  invoice_done: boolean;
  invoice_reference: string;
  project_notes: string;
  payment_notes: string;
};

const DEFAULT_MONTH = normalizeMonthKey();

function formatMoney(amount: number, currency: FinanceCurrency): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatMonthLabel(monthKey: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${monthKey}-01T00:00:00`));
}

function createDefaultFormState(): FinanceFormState {
  return {
    booking_id: "",
    client_name: "",
    project_label: "",
    session_date: "",
    work_context: "malmo_studio",
    payment_label: "session payment",
    payment_date: `${DEFAULT_MONTH}-01`,
    gross_amount: "",
    currency: "SEK",
    payment_method: "cash",
    fee_percentage: "30",
    invoice_needed: false,
    invoice_done: false,
    invoice_reference: "",
    project_notes: "",
    payment_notes: "",
  };
}

export default function AdminFinancePage() {
  const router = useRouter();
  const [month, setMonth] = useState(DEFAULT_MONTH);
  const [dashboard, setDashboard] = useState<FinanceDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FinanceFormState>(createDefaultFormState());

  const fetchDashboard = useCallback(async (monthKey: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/finance?month=${monthKey}`);
      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load finance dashboard");
      }

      const data = (await response.json()) as FinanceDashboardResponse;
      setDashboard(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load finance dashboard");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboard(month);
  }, [fetchDashboard, month]);

  useEffect(() => {
    if (!dashboard) return;

    setForm((current) => {
      const contextSettings = dashboard.context_settings;
      const feeDefault = getContextFeeDefault(current.work_context, contextSettings);
      const currencyDefault = getContextCurrencyDefault(
        current.work_context,
        contextSettings
      );

      if (
        current.currency === currencyDefault &&
        current.fee_percentage === String(feeDefault)
      ) {
        return current;
      }

      return {
        ...current,
        currency: currencyDefault,
        fee_percentage: String(feeDefault),
      };
    });
  }, [dashboard]);

  const previousMonth = useMemo(() => getPreviousMonthKey(month), [month]);
  const projects = dashboard?.projects ?? [];
  const invoiceReminders = dashboard?.invoice_reminders ?? [];
  const bookings = dashboard?.bookings ?? [];

  function applyBookingPrefill(bookingId: string) {
    if (!dashboard) return;

    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) return;

    const workContext: FinanceWorkContext =
      booking.location === "copenhagen" ? "copenhagen_studio" : "malmo_studio";

    setForm((current) => ({
      ...current,
      booking_id: booking.id,
      client_name: booking.client_name,
      project_label:
        current.project_label || `${booking.client_name} ${booking.type}`,
      session_date: booking.appointment_date?.slice(0, 10) ?? current.session_date,
      work_context: workContext,
      currency: getContextCurrencyDefault(workContext, dashboard.context_settings),
      fee_percentage: String(
        getContextFeeDefault(workContext, dashboard.context_settings)
      ),
    }));
  }

  function resetForm() {
    const next = createDefaultFormState();
    if (dashboard) {
      next.currency = getContextCurrencyDefault("malmo_studio", dashboard.context_settings);
      next.fee_percentage = String(
        getContextFeeDefault("malmo_studio", dashboard.context_settings)
      );
    }
    setForm(next);
  }

  function updateForm<Key extends keyof FinanceFormState>(
    key: Key,
    value: FinanceFormState[Key]
  ) {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "work_context" && dashboard) {
        next.currency = getContextCurrencyDefault(value as FinanceWorkContext, dashboard.context_settings);
        next.fee_percentage = String(
          getContextFeeDefault(value as FinanceWorkContext, dashboard.context_settings)
        );
      }

      if (key === "payment_method" && dashboard) {
        next.invoice_needed = value === "card" ? dashboard.settings.card_invoice_default : false;
      }

      return next;
    });
  }

  async function handleCreateEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          booking_id: form.booking_id || null,
          gross_amount: Number(form.gross_amount),
          fee_percentage: Number(form.fee_percentage),
          invoice_reference: form.invoice_reference || null,
          project_notes: form.project_notes || null,
          payment_notes: form.payment_notes || null,
        }),
      });

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create finance entry");
      }

      const nextDashboard = data as FinanceDashboardResponse;
      setDashboard(nextDashboard);
      setMonth(data.month);
      setShowForm(false);
      const nextForm = createDefaultFormState();
      nextForm.currency = getContextCurrencyDefault(
        "malmo_studio",
        nextDashboard.context_settings
      );
      nextForm.fee_percentage = String(
        getContextFeeDefault("malmo_studio", nextDashboard.context_settings)
      );
      setForm(nextForm);
      setSuccess("Finance entry saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create finance entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleInvoiceDone(project: FinanceProjectWithPayments, paymentId: string, invoiceDone: boolean) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payment = project.payments.find((item) => item.id === paymentId);
      if (!payment) return;

      const response = await fetch("/api/admin/finance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: paymentId,
          invoice_done: invoiceDone,
        }),
      });

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update payment");
      }

      setDashboard(data as FinanceDashboardResponse);
      setSuccess(invoiceDone ? "Invoice marked done." : "Invoice reopened.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Finance"
      description="Track tattoo projects, studio fees, and invoice reminders in one admin flow that saves Lia from month-end math headaches."
      activeTab="finance"
      maxWidth="wide"
      actions={
        <div className="flex flex-wrap gap-2">
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="min-h-[40px] rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm"
            style={{ fontSize: "16px" }}
          />
          <AdminButton
            variant={showForm ? "secondary" : "primary"}
            onClick={() => {
              setShowForm((current) => !current);
              setSuccess("");
            }}
          >
            {showForm ? "Hide form" : "Add finance entry"}
          </AdminButton>
        </div>
      }
    >
      {error ? (
        <div className="mb-4">
          <AdminAlert>
            {error}
            <button onClick={() => setError("")} className="ml-2 underline">
              dismiss
            </button>
          </AdminAlert>
        </div>
      ) : null}

      {success ? (
        <div className="mb-4">
          <AdminAlert tone="info">{success}</AdminAlert>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard
          label={formatMonthLabel(month)}
          value={loading ? "..." : `${dashboard?.summary.entry_count ?? 0} payments`}
          detail="Count of payments recorded in the selected month."
        />
        <AdminMetricCard
          label="Invoice reminders"
          value={loading ? "..." : dashboard?.summary.open_invoice_count ?? 0}
          tone={(dashboard?.summary.open_invoice_count ?? 0) > 0 ? "warning" : "default"}
          detail="Card / SumUp payments still waiting for invoice handling."
        />
        <AdminMetricCard
          label="Net totals"
          value={
            loading || !dashboard
              ? "..."
              : `${formatMoney(dashboard.summary.net_totals.SEK, "SEK")} / ${formatMoney(
                  dashboard.summary.net_totals.DKK,
                  "DKK"
                )} / ${formatMoney(dashboard.summary.net_totals.EUR, "EUR")}`
          }
          detail="Net amounts after studio fees, kept separate by currency."
        />
        <AdminMetricCard
          label="Studio fees"
          value={
            loading || !dashboard
              ? "..."
              : `${formatMoney(dashboard.summary.fee_totals.SEK, "SEK")} / ${formatMoney(
                  dashboard.summary.fee_totals.DKK,
                  "DKK"
                )} / ${formatMoney(dashboard.summary.fee_totals.EUR, "EUR")}`
          }
          tone="accent"
          detail="How much goes to studios or guest-fee structures this month."
        />
        <AdminMetricCard
          label={`Approx ${dashboard?.summary.approx_primary.currency ?? "SEK"}`}
          value={
            loading || !dashboard
              ? "..."
              : formatMoney(
                  dashboard.summary.approx_primary.amount,
                  dashboard.summary.approx_primary.currency
                )
          }
          detail={
            loading || !dashboard
              ? ""
              : `vs ${formatMonthLabel(previousMonth)}: ${dashboard.summary.comparison.percent_delta === null ? "new month" : `${dashboard.summary.comparison.percent_delta}%`}`
          }
        />
      </div>

      {showForm ? (
        <AdminSurface className="mb-6">
          <AdminSectionHeading
            title="Add finance entry"
            description="One tattoo project, one or more payments. Start simple and keep the defaults working for Lia instead of against her."
          />

          <form className="grid gap-5" onSubmit={handleCreateEntry}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm text-foreground-muted">
                Existing booking (optional)
                <select
                  value={form.booking_id}
                  onChange={(event) => {
                    const bookingId = event.target.value;
                    updateForm("booking_id", bookingId);
                    if (bookingId) applyBookingPrefill(bookingId);
                  }}
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                >
                  <option value="">No linked booking</option>
                  {bookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.client_name} · {booking.type} · {booking.location}
                      {booking.is_linked ? " · linked" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-foreground-muted">
                Client name
                <input
                  value={form.client_name}
                  onChange={(event) => updateForm("client_name", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                  required
                />
              </label>

              <label className="text-sm text-foreground-muted">
                Project label
                <input
                  value={form.project_label}
                  onChange={(event) => updateForm("project_label", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                  required
                />
              </label>

              <label className="text-sm text-foreground-muted">
                Session date
                <input
                  type="date"
                  value={form.session_date}
                  onChange={(event) => updateForm("session_date", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <label className="text-sm text-foreground-muted">
                Work context
                <select
                  value={form.work_context}
                  onChange={(event) =>
                    updateForm("work_context", event.target.value as FinanceWorkContext)
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                >
                  {FINANCE_WORK_CONTEXT_OPTIONS.map((context) => (
                    <option key={context} value={context}>
                      {dashboard
                        ? getContextLabel(context, dashboard.context_settings)
                        : context}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-foreground-muted">
                Payment label
                <input
                  value={form.payment_label}
                  onChange={(event) => updateForm("payment_label", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                />
              </label>

              <label className="text-sm text-foreground-muted">
                Payment date
                <input
                  type="date"
                  value={form.payment_date}
                  onChange={(event) => updateForm("payment_date", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                  required
                />
              </label>

              <label className="text-sm text-foreground-muted">
                Gross amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.gross_amount}
                  onChange={(event) => updateForm("gross_amount", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                  required
                />
              </label>

              <label className="text-sm text-foreground-muted">
                Currency
                <select
                  value={form.currency}
                  onChange={(event) =>
                    updateForm("currency", event.target.value as FinanceCurrency)
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                >
                  {FINANCE_CURRENCY_OPTIONS.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm text-foreground-muted">
                Payment method
                <select
                  value={form.payment_method}
                  onChange={(event) =>
                    updateForm(
                      "payment_method",
                      event.target.value as FinancePaymentMethod
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                >
                  {FINANCE_PAYMENT_METHOD_OPTIONS.map((method) => (
                    <option key={method} value={method}>
                      {FINANCE_PAYMENT_METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-foreground-muted">
                Studio fee %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.fee_percentage}
                  onChange={(event) => updateForm("fee_percentage", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                />
              </label>

              <label className="text-sm text-foreground-muted">
                Invoice reference
                <input
                  value={form.invoice_reference}
                  onChange={(event) => updateForm("invoice_reference", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                  placeholder="Optional"
                />
              </label>

              <div className="flex items-end gap-4 rounded-2xl bg-[var(--sabbia-50)] px-4 py-3 text-sm text-foreground-muted">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.invoice_needed}
                    onChange={(event) => updateForm("invoice_needed", event.target.checked)}
                  />
                  Invoice needed
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.invoice_done}
                    onChange={(event) => updateForm("invoice_done", event.target.checked)}
                  />
                  Invoice done
                </label>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-foreground-muted">
                Project notes
                <textarea
                  value={form.project_notes}
                  onChange={(event) => updateForm("project_notes", event.target.value)}
                  className="mt-1 min-h-[112px] w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                />
              </label>

              <label className="text-sm text-foreground-muted">
                Payment notes
                <textarea
                  value={form.payment_notes}
                  onChange={(event) => updateForm("payment_notes", event.target.value)}
                  className="mt-1 min-h-[112px] w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <AdminButton variant="primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save finance entry"}
              </AdminButton>
              <AdminButton
                variant="secondary"
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancel
              </AdminButton>
            </div>
          </form>
        </AdminSurface>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <AdminSurface>
            <AdminSectionHeading
              title="Studio fee totals"
              description="How much each studio/context takes this month, grouped in its own currency."
            />

            {loading ? (
              <p className="text-sm text-foreground-muted">Loading fee totals...</p>
            ) : dashboard && dashboard.summary.fee_totals_by_context.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-[var(--sabbia-200)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[var(--sabbia-50)] text-foreground-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Context</th>
                      <th className="px-4 py-3 font-medium">Gross</th>
                      <th className="px-4 py-3 font-medium">Fee</th>
                      <th className="px-4 py-3 font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.summary.fee_totals_by_context.map((row) => (
                      <tr key={`${row.work_context}:${row.currency}`} className="border-t border-[var(--sabbia-200)] bg-white">
                        <td className="px-4 py-3 text-foreground">
                          {getContextLabel(row.work_context, dashboard.context_settings)}
                          <div className="text-xs text-foreground-muted">
                            {row.entry_count} payment{row.entry_count === 1 ? "" : "s"} · {row.currency}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground-muted">
                          {formatMoney(row.gross_total, row.currency)}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {formatMoney(row.fee_total, row.currency)}
                        </td>
                        <td className="px-4 py-3 text-foreground-muted">
                          {formatMoney(row.net_total, row.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <AdminEmptyState
                title="No fee totals yet"
                description="As soon as payments are added for the selected month, this view will show how much each studio/context takes in its own currency."
              />
            )}
          </AdminSurface>

          <AdminSurface>
            <AdminSectionHeading
              title="Projects this month"
              description="Every tattoo project can carry one or more payments, so deposits and finals don’t get flattened into nonsense."
            />

            {loading ? (
              <p className="text-sm text-foreground-muted">Loading projects...</p>
            ) : projects.length > 0 ? (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div key={project.id} className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/60 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {project.project_label}
                        </p>
                        <p className="mt-1 text-xs text-foreground-muted">
                          {project.client_name} · {getContextLabel(project.work_context, dashboard?.context_settings)}
                          {project.session_date ? ` · session ${project.session_date}` : ""}
                        </p>
                      </div>
                      {project.booking_id ? (
                        <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] text-foreground-muted shadow-sm">
                          linked booking
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3">
                      {project.payments.map((payment) => (
                        <div key={payment.id} className="rounded-xl bg-white p-3 shadow-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {payment.payment_label}
                              </p>
                              <p className="text-xs text-foreground-muted">
                                {payment.payment_date} · {FINANCE_PAYMENT_METHOD_LABELS[payment.payment_method]}
                              </p>
                            </div>
                            <div className="text-right text-xs text-foreground-muted">
                              <p>Gross {formatMoney(payment.gross_amount, payment.currency)}</p>
                              <p>Fee {formatMoney(payment.fee_amount, payment.currency)}</p>
                              <p className="font-medium text-foreground">
                                Net {formatMoney(payment.net_amount, payment.currency)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-[var(--sabbia-50)] px-2.5 py-1 text-foreground-muted">
                              {payment.fee_percentage}% studio fee
                            </span>
                            {payment.invoice_needed ? (
                              <button
                                onClick={() =>
                                  handleToggleInvoiceDone(project, payment.id, !payment.invoice_done)
                                }
                                className={`rounded-full px-2.5 py-1 transition-colors ${
                                  payment.invoice_done
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {payment.invoice_done ? "Invoice done" : "Invoice needed"}
                              </button>
                            ) : (
                              <span className="rounded-full bg-[var(--sabbia-50)] px-2.5 py-1 text-foreground-muted">
                                No invoice reminder
                              </span>
                            )}
                            {payment.invoice_reference ? (
                              <span className="rounded-full bg-[var(--sabbia-50)] px-2.5 py-1 text-foreground-muted">
                                Ref {payment.invoice_reference}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmptyState
                title="No finance entries yet"
                description="Add the first project and payment for this month, then the dashboard will start behaving like a proper studio ledger instead of empty ceremony."
                action={
                  <AdminButton variant="primary" onClick={() => setShowForm(true)}>
                    Add first finance entry
                  </AdminButton>
                }
              />
            )}
          </AdminSurface>
        </div>

        <div className="space-y-6">
          <AdminSurface>
            <AdminSectionHeading
              title="Invoice reminders"
              description="Card payments should nudge Lia to invoice, but still stay editable when reality gets messy."
            />

            {loading ? (
              <p className="text-sm text-foreground-muted">Loading reminders...</p>
            ) : invoiceReminders.length > 0 ? (
              <div className="space-y-3">
                {invoiceReminders.map((payment) => (
                  <div key={payment.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                    <p className="font-medium text-foreground">{payment.client_name}</p>
                    <p className="mt-1 text-xs text-foreground-muted">
                      {payment.project_label} · {payment.payment_date} · {FINANCE_PAYMENT_METHOD_LABELS[payment.payment_method]}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-foreground-muted">
                        {formatMoney(payment.gross_amount, payment.currency)} gross
                      </span>
                      <AdminButton
                        variant="secondary"
                        className="!min-h-[32px] !px-3 !py-1 text-xs"
                        onClick={() => {
                          const project = projects.find(
                            (item) => item.id === payment.project_id
                          );
                          if (!project) return;
                          handleToggleInvoiceDone(project, payment.id, true);
                        }}
                      >
                        Mark done
                      </AdminButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">
                No open invoice reminders for {formatMonthLabel(month)}.
              </p>
            )}
          </AdminSurface>

          <AdminSurface>
            <AdminSectionHeading
              title="Currency view"
              description="Keep the honest totals per currency, then layer approximate normalized views on top. No fake accounting cosplay."
            />

            {dashboard ? (
              <div className="space-y-3 text-sm">
                {(["SEK", "DKK", "EUR"] as FinanceCurrency[]).map((currency) => (
                  <div key={currency} className="rounded-xl bg-[var(--sabbia-50)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-foreground-muted">Net in {currency}</span>
                      <span className="font-medium text-foreground">
                        {formatMoney(dashboard.summary.net_totals[currency], currency)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-foreground-muted">
                      <span>Fees in {currency}</span>
                      <span>
                        {formatMoney(dashboard.summary.fee_totals[currency], currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </AdminSurface>
        </div>
      </div>
    </AdminShell>
  );
}
