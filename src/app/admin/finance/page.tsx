"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminShell,
  AdminSurface,
} from "@/components/admin/AdminShell";
import {
  AdminAlert,
  AdminButton,
  AdminSectionHeading,
} from "@/components/admin/AdminPrimitives";
import {
  DEFAULT_CARD_PROCESSOR_FEE_PERCENTAGE,
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
  FinanceMonthlyTrendPoint,
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
  reporting_currency: FinanceCurrency;
  payment_method: FinancePaymentMethod;
  fee_percentage: string;
  processor_fee_percentage: string;
  invoice_needed: boolean;
  invoice_done: boolean;
  invoice_reference: string;
  project_notes: string;
  payment_notes: string;
};

const DEFAULT_MONTH = normalizeMonthKey();
const REPORTING_CURRENCIES: FinanceCurrency[] = ["SEK", "DKK", "EUR"];

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

function formatDelta(percentDelta: number | null): string {
  if (percentDelta === null) return "new month";
  if (percentDelta === 0) return "flat vs last month";
  return `${percentDelta > 0 ? "+" : ""}${percentDelta}% vs last month`;
}

function buildDefaultFormState(
  dashboard: FinanceDashboardResponse | null,
  monthKey: string
): FinanceFormState {
  const workContext: FinanceWorkContext = "malmo_studio";
  const currency = dashboard
    ? getContextCurrencyDefault(workContext, dashboard.context_settings)
    : "SEK";
  const feePercentage = dashboard
    ? getContextFeeDefault(workContext, dashboard.context_settings)
    : 30;

  return {
    booking_id: "",
    client_name: "",
    project_label: "",
    session_date: "",
    work_context: workContext,
    payment_label: "session payment",
    payment_date: `${monthKey}-01`,
    gross_amount: "",
    currency,
    reporting_currency: currency,
    payment_method: "cash",
    fee_percentage: String(feePercentage),
    processor_fee_percentage: "0",
    invoice_needed: false,
    invoice_done: false,
    invoice_reference: "",
    project_notes: "",
    payment_notes: "",
  };
}

function getTrendBarHeight(value: number, maxValue: number): string {
  if (maxValue <= 0) return "10%";
  return `${Math.max(10, (value / maxValue) * 100)}%`;
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
  const [form, setForm] = useState<FinanceFormState>(
    buildDefaultFormState(null, DEFAULT_MONTH)
  );

  const fetchDashboard = useCallback(
    async (monthKey: string) => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/finance?month=${monthKey}`, {
          cache: "no-store",
        });
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
    },
    [router]
  );

  useEffect(() => {
    fetchDashboard(month);
  }, [fetchDashboard, month]);

  useEffect(() => {
    if (!dashboard || showForm) return;
    setForm(buildDefaultFormState(dashboard, month));
  }, [dashboard, month, showForm]);

  const summary = dashboard?.summary;
  const bookings = dashboard?.bookings ?? [];
  const invoiceReminders = dashboard?.invoice_reminders ?? [];
  const previousMonth = useMemo(() => getPreviousMonthKey(month), [month]);

  const monthlyProjects = useMemo(
    () =>
      (dashboard?.projects ?? []).map((project) => ({
        ...project,
        payments: project.payments.filter((payment) => payment.payment_date.startsWith(month)),
      })),
    [dashboard?.projects, month]
  );

  const reportingBucketCurrencies = useMemo(
    () =>
      REPORTING_CURRENCIES.filter((currency) => {
        if (!summary) return false;
        return (
          summary.net_totals_by_reporting_currency[currency] > 0 ||
          summary.studio_fee_totals_by_reporting_currency[currency] > 0 ||
          summary.processor_fee_totals_by_payment_currency[currency] > 0
        );
      }),
    [summary]
  );

  const trendMax = useMemo(() => {
    const points = summary?.monthly_trend ?? [];
    return points.reduce((max, point) => Math.max(max, point.net_total), 0);
  }, [summary?.monthly_trend]);

  function resetForm(nextMonth = month, nextDashboard = dashboard) {
    setForm(buildDefaultFormState(nextDashboard, nextMonth));
  }

  function applyBookingPrefill(bookingId: string) {
    if (!dashboard) return;

    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) return;

    const workContext: FinanceWorkContext =
      booking.location === "copenhagen" ? "copenhagen_studio" : "malmo_studio";
    const defaultCurrency = getContextCurrencyDefault(workContext, dashboard.context_settings);
    const defaultFee = getContextFeeDefault(workContext, dashboard.context_settings);

    setForm((current) => ({
      ...current,
      booking_id: booking.id,
      client_name: booking.client_name,
      project_label: current.project_label || `${booking.client_name} ${booking.type}`,
      session_date: booking.appointment_date?.slice(0, 10) ?? current.session_date,
      work_context: workContext,
      currency: defaultCurrency,
      reporting_currency: defaultCurrency,
      fee_percentage: String(defaultFee),
    }));
  }

  function updateForm<Key extends keyof FinanceFormState>(
    key: Key,
    value: FinanceFormState[Key]
  ) {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "work_context" && dashboard) {
        const workContext = value as FinanceWorkContext;
        const defaultCurrency = getContextCurrencyDefault(
          workContext,
          dashboard.context_settings
        );
        next.currency = defaultCurrency;
        next.reporting_currency = defaultCurrency;
        next.fee_percentage = String(
          getContextFeeDefault(workContext, dashboard.context_settings)
        );
      }

      if (key === "payment_method" && dashboard) {
        const method = value as FinancePaymentMethod;
        const needsInvoice = method === "card" && dashboard.settings.card_invoice_default;
        next.invoice_needed = needsInvoice;
        next.processor_fee_percentage =
          method === "card"
            ? String(
                dashboard.settings.card_processor_fee_percentage ??
                  DEFAULT_CARD_PROCESSOR_FEE_PERCENTAGE
              )
            : "0";
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
          client_name: form.client_name || null,
          project_label: form.project_label || null,
          gross_amount: Number(form.gross_amount),
          fee_percentage: Number(form.fee_percentage),
          processor_fee_percentage: Number(form.processor_fee_percentage),
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
      setMonth(nextDashboard.month);
      setShowForm(false);
      resetForm(nextDashboard.month, nextDashboard);
      setSuccess("Finance entry saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create finance entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleInvoiceDone(
    project: FinanceProjectWithPayments,
    paymentId: string,
    invoiceDone: boolean
  ) {
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

  function renderBucketCard(currency: FinanceCurrency) {
    if (!summary) return null;

    return (
      <div
        key={currency}
        className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
            {currency} bucket
          </p>
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-foreground-muted shadow-sm">
            context-based reporting
          </span>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-foreground-muted">Take-home</span>
            <span className="font-medium text-foreground">
              {formatMoney(summary.net_totals_by_reporting_currency[currency], currency)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-foreground-muted">Studio fees</span>
            <span className="text-foreground">
              {formatMoney(summary.studio_fee_totals_by_reporting_currency[currency], currency)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-foreground-muted">Card fees paid in {currency}</span>
            <span className="text-foreground">
              {formatMoney(summary.processor_fee_totals_by_payment_currency[currency], currency)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  function renderTrendBar(point: FinanceMonthlyTrendPoint, primaryCurrency: FinanceCurrency) {
    return (
      <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
        <div className="flex h-40 w-full items-end justify-center rounded-2xl bg-[var(--sabbia-50)] px-2 py-3">
          <div
            className="w-full max-w-12 rounded-t-xl bg-[var(--ink-900)]/85"
            style={{ height: getTrendBarHeight(point.net_total, trendMax) }}
          />
        </div>
        <div className="text-center text-xs">
          <p className="font-medium text-foreground">{point.label}</p>
          <p className="mt-1 text-foreground-muted">
            {formatMoney(point.net_total, primaryCurrency)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminShell
      title="Finance"
      description="Track monthly take-home, studio splits, card fees, and invoice reminders without turning Lia’s admin into fake accounting theater."
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
              if (showForm) {
                resetForm();
              }
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
          label="Net take-home"
          value={
            loading || !summary
              ? "..."
              : formatMoney(summary.month_total, summary.approx_primary.currency)
          }
          detail={
            loading || !summary
              ? ""
              : `${formatMonthLabel(month)} in ${summary.approx_primary.currency}`
          }
        />
        <AdminMetricCard
          label="This week"
          value={
            loading || !summary
              ? "..."
              : formatMoney(summary.week_total, summary.approx_primary.currency)
          }
          detail={
            loading || !summary
              ? ""
              : `${summary.weekly.at(-1)?.label ?? "No payments this week"}`
          }
        />
        <AdminMetricCard
          label="Studio fees"
          tone="accent"
          value={
            loading || !summary
              ? "..."
              : `${formatMoney(summary.studio_fee_totals_by_reporting_currency.SEK, "SEK")} · ${formatMoney(summary.studio_fee_totals_by_reporting_currency.DKK, "DKK")} · ${formatMoney(summary.studio_fee_totals_by_reporting_currency.EUR, "EUR")}`
          }
          detail="Native fee buckets by studio/context, not by whichever currency the client happened to use."
        />
        <AdminMetricCard
          label={`Approx ${summary?.approx_secondary.currency ?? "EUR"}`}
          value={
            loading || !summary
              ? "..."
              : formatMoney(
                  summary.approx_secondary.amount,
                  summary.approx_secondary.currency
                )
          }
          detail={
            loading || !summary
              ? ""
              : `${summary.approx_secondary.source} exchange rates`
          }
        />
        <AdminMetricCard
          label="Open invoices"
          value={loading ? "..." : summary?.open_invoice_count ?? 0}
          tone={(summary?.open_invoice_count ?? 0) > 0 ? "warning" : "success"}
          detail={
            loading || !summary
              ? ""
              : `${summary.entry_count} payment${summary.entry_count === 1 ? "" : "s"} logged this month`
          }
        />
      </div>

      {showForm ? (
        <AdminSurface className="mb-6">
          <AdminSectionHeading
            title="Quick finance entry"
            description="Keep the required fields brutally short, then let Lia override the defaults only when reality demands it."
          />

          <form className="grid gap-5" onSubmit={handleCreateEntry}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                      {dashboard ? getContextLabel(context, dashboard.context_settings) : context}
                    </option>
                  ))}
                </select>
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
                Payment method
                <select
                  value={form.payment_method}
                  onChange={(event) =>
                    updateForm("payment_method", event.target.value as FinancePaymentMethod)
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
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm text-foreground-muted">
                Payment currency
                <select
                  value={form.currency}
                  onChange={(event) => updateForm("currency", event.target.value as FinanceCurrency)}
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

              <label className="text-sm text-foreground-muted">
                Reporting bucket
                <select
                  value={form.reporting_currency}
                  onChange={(event) =>
                    updateForm("reporting_currency", event.target.value as FinanceCurrency)
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
                Card processor fee %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.processor_fee_percentage}
                  onChange={(event) =>
                    updateForm("processor_fee_percentage", event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm text-foreground-muted">
                Client name (optional)
                <input
                  value={form.client_name}
                  onChange={(event) => updateForm("client_name", event.target.value)}
                  placeholder="Walk-in / direct client"
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                />
              </label>

              <label className="text-sm text-foreground-muted">
                Project label (optional)
                <input
                  value={form.project_label}
                  onChange={(event) => updateForm("project_label", event.target.value)}
                  placeholder="Tattoo session"
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                />
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
                Session date (optional)
                <input
                  type="date"
                  value={form.session_date}
                  onChange={(event) => updateForm("session_date", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <label className="text-sm text-foreground-muted">
                Invoice reference
                <input
                  value={form.invoice_reference}
                  onChange={(event) => updateForm("invoice_reference", event.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                />
              </label>

              <div className="rounded-2xl bg-[var(--sabbia-50)] px-4 py-3 text-sm text-foreground-muted">
                <p className="font-medium text-foreground">Selected defaults</p>
                <p className="mt-1">
                  {dashboard ? getContextLabel(form.work_context, dashboard.context_settings) : form.work_context}
                  {" "}
                  reports in {form.reporting_currency} and uses {form.fee_percentage}% studio fee.
                </p>
                <p className="mt-1">
                  {form.payment_method === "card"
                    ? `Card fee currently deducts ${form.processor_fee_percentage}% and invoice reminder is ${form.invoice_needed ? "on" : "off"}.`
                    : "Non-card payments default to 0% processor fee."}
                </p>
              </div>

              <div className="flex flex-col justify-end gap-2 rounded-2xl bg-[var(--sabbia-50)] px-4 py-3 text-sm text-foreground-muted">
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

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminSurface>
          <AdminSectionHeading
            title="Reporting buckets"
            description="Top cards show the overview. These buckets show the honest monthly breakdown by studio/context currency."
          />

          {loading ? (
            <p className="text-sm text-foreground-muted">Loading reporting buckets...</p>
          ) : summary ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {(reportingBucketCurrencies.length > 0
                  ? reportingBucketCurrencies
                  : REPORTING_CURRENCIES
                ).map(renderBucketCard)}
              </div>
              <div className="rounded-2xl border border-[var(--sabbia-200)] bg-white p-4 text-sm text-foreground-muted">
                <p className="font-medium text-foreground">Month-on-month pulse</p>
                <p className="mt-1">
                  {formatMonthLabel(previousMonth)} to {formatMonthLabel(month)}: {formatDelta(summary.comparison.percent_delta)}
                  {summary.comparison.amount_delta !== 0
                    ? ` (${summary.comparison.amount_delta > 0 ? "+" : ""}${formatMoney(
                        summary.comparison.amount_delta,
                        summary.approx_primary.currency
                      )})`
                    : ""}
                </p>
              </div>
            </div>
          ) : null}
        </AdminSurface>

        <AdminSurface>
          <AdminSectionHeading
            title="Weekly view"
            description="Quick weekly visibility so month-end math doesn’t hide a dead or unusually strong week."
          />

          {loading ? (
            <p className="text-sm text-foreground-muted">Loading weekly summary...</p>
          ) : summary && summary.weekly.length > 0 ? (
            <div className="space-y-3">
              {summary.weekly.map((week) => (
                <div
                  key={week.week_key}
                  className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{week.label}</p>
                      <p className="mt-1 text-xs text-foreground-muted">
                        {week.month_entry_count} payment{week.month_entry_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {formatMoney(week.net_total, summary.approx_primary.currency)}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-foreground-muted sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3">
                      <span>Studio fees</span>
                      <span>
                        {formatMoney(week.studio_fee_total, summary.approx_primary.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Processor fees</span>
                      <span>
                        {formatMoney(week.processor_fee_total, summary.approx_primary.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">
              No weekly payments recorded for {formatMonthLabel(month)}.
            </p>
          )}
        </AdminSurface>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <AdminSurface>
            <AdminSectionHeading
              title="Studio / context totals"
              description="Grouped by actual working context and native reporting bucket, so Malmö and Copenhagen stop bleeding into a fake currency view."
            />

            {loading ? (
              <p className="text-sm text-foreground-muted">Loading studio totals...</p>
            ) : summary && summary.fee_totals_by_context.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-[var(--sabbia-200)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[var(--sabbia-50)] text-foreground-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Context</th>
                      <th className="px-4 py-3 font-medium">Gross</th>
                      <th className="px-4 py-3 font-medium">Studio fee</th>
                      <th className="px-4 py-3 font-medium">Card fee</th>
                      <th className="px-4 py-3 font-medium">Take-home</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.fee_totals_by_context.map((row) => (
                      <tr
                        key={`${row.work_context}:${row.reporting_currency}`}
                        className="border-t border-[var(--sabbia-200)] bg-white"
                      >
                        <td className="px-4 py-3 text-foreground">
                          {getContextLabel(row.work_context, dashboard?.context_settings)}
                          <div className="text-xs text-foreground-muted">
                            {row.entry_count} payment{row.entry_count === 1 ? "" : "s"} · {row.reporting_currency}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground-muted">
                          {formatMoney(row.gross_total, row.reporting_currency)}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {formatMoney(row.fee_total, row.reporting_currency)}
                        </td>
                        <td className="px-4 py-3 text-foreground-muted">
                          {formatMoney(row.processor_fee_total, row.reporting_currency)}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {formatMoney(row.net_total, row.reporting_currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <AdminEmptyState
                title="No totals yet"
                description="Add the first finance entry for this month and the context totals will start behaving like a proper studio tracker."
              />
            )}
          </AdminSurface>

          <AdminSurface>
            <AdminSectionHeading
              title="Projects this month"
              description="Each payment shows gross, studio fee, card fee, and take-home so Lia doesn’t need to mentally reverse-engineer every line."
            />

            {loading ? (
              <p className="text-sm text-foreground-muted">Loading projects...</p>
            ) : monthlyProjects.length > 0 ? (
              <div className="space-y-4">
                {monthlyProjects.map((project) => (
                  <div
                    key={project.id}
                    className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/60 p-4"
                  >
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
                      <div className="flex flex-wrap gap-2">
                        {project.booking_id ? (
                          <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] text-foreground-muted shadow-sm">
                            linked booking
                          </span>
                        ) : null}
                        <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] text-foreground-muted shadow-sm">
                          {project.payments.length} payment{project.payments.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    {project.payments.length > 0 ? (
                      <div className="mt-4 grid gap-3">
                        {project.payments.map((payment) => (
                          <div key={payment.id} className="rounded-xl bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {payment.payment_label}
                                </p>
                                <p className="mt-1 text-xs text-foreground-muted">
                                  {payment.payment_date} · {FINANCE_PAYMENT_METHOD_LABELS[payment.payment_method]}
                                  {` · paid in ${payment.currency} · reports in ${payment.reporting_currency}`}
                                </p>
                              </div>
                              <div className="grid gap-1 text-right text-xs sm:min-w-48">
                                <p className="text-foreground-muted">
                                  Gross {formatMoney(payment.gross_amount, payment.currency)}
                                </p>
                                <p className="text-foreground-muted">
                                  Studio fee {formatMoney(payment.fee_amount, payment.currency)}
                                </p>
                                <p className="text-foreground-muted">
                                  Card fee {formatMoney(payment.processor_fee_amount, payment.currency)}
                                </p>
                                <p className="font-medium text-foreground">
                                  Take-home {formatMoney(payment.net_amount, payment.currency)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                              <span className="rounded-full bg-[var(--sabbia-50)] px-2.5 py-1 text-foreground-muted">
                                {payment.fee_percentage}% studio fee
                              </span>
                              <span className="rounded-full bg-[var(--sabbia-50)] px-2.5 py-1 text-foreground-muted">
                                {payment.processor_fee_percentage}% processor fee
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
                    ) : (
                      <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-foreground-muted shadow-sm">
                        Session tracked for this month, but no payment line has been logged yet.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmptyState
                title="No finance entries yet"
                description="Add the first payment for this month and the dashboard will stop looking like an accountant’s waiting room."
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
              title="Last 6 months"
              description="Take-home trend in the primary reporting currency, so the direction of travel is obvious at a glance."
            />

            {loading ? (
              <p className="text-sm text-foreground-muted">Loading trend...</p>
            ) : summary && summary.monthly_trend.length > 0 ? (
              <div>
                <div className="flex items-end gap-3 overflow-x-auto pb-2">
                  {summary.monthly_trend.map((point) =>
                    renderTrendBar(point, summary.approx_primary.currency)
                  )}
                </div>
                <div className="mt-4 rounded-2xl bg-[var(--sabbia-50)] px-4 py-3 text-xs text-foreground-muted">
                  Dark bars show take-home. Week and card-fee details stay separate below so the chart doesn’t turn into a spaghetti monster.
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">
                Trend data will appear once there are payments across multiple months.
              </p>
            )}
          </AdminSurface>

          <AdminSurface>
            <AdminSectionHeading
              title="Invoice reminders"
              description="Card payments should nudge Lia to invoice without locking her into some bureaucratic pantomime."
            />

            {loading ? (
              <p className="text-sm text-foreground-muted">Loading reminders...</p>
            ) : invoiceReminders.length > 0 ? (
              <div className="space-y-3">
                {invoiceReminders.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"
                  >
                    <p className="font-medium text-foreground">{payment.client_name}</p>
                    <p className="mt-1 text-xs text-foreground-muted">
                      {payment.project_label} · {payment.payment_date} · {FINANCE_PAYMENT_METHOD_LABELS[payment.payment_method]}
                    </p>
                    <div className="mt-2 grid gap-1 text-xs text-foreground-muted">
                      <p>Gross {formatMoney(payment.gross_amount, payment.currency)}</p>
                      <p>Studio fee {formatMoney(payment.fee_amount, payment.currency)}</p>
                      <p>Card fee {formatMoney(payment.processor_fee_amount, payment.currency)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-foreground-muted">
                        Take-home {formatMoney(payment.net_amount, payment.currency)}
                      </span>
                      <AdminButton
                        variant="secondary"
                        className="!min-h-[32px] !px-3 !py-1 text-xs"
                        onClick={() => {
                          const project = monthlyProjects.find(
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
        </div>
      </div>
    </AdminShell>
  );
}
