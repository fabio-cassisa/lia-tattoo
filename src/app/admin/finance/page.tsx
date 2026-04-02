"use client";

import type { ReactNode } from "react";
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
  FINANCE_TAX_FRAMEWORK_LABELS,
  FINANCE_VARIABLE_EXPENSE_CATEGORY_LABELS,
  FINANCE_VARIABLE_EXPENSE_CATEGORY_OPTIONS,
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
  FinanceVariableExpenseCategory,
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
  studio_fee_base_amount: string;
  studio_fee_base_currency: FinanceCurrency;
  processor_fee_percentage: string;
  invoice_needed: boolean;
  invoice_done: boolean;
  invoice_reference: string;
  project_notes: string;
  payment_notes: string;
};

type VariableExpenseFormState = {
  expense_date: string;
  label: string;
  category: FinanceVariableExpenseCategory;
  amount: string;
  currency: FinanceCurrency;
  notes: string;
};

const DEFAULT_MONTH = normalizeMonthKey();
const REPORTING_CURRENCIES: FinanceCurrency[] = ["SEK", "DKK", "EUR"];
const DAY_IN_MS = 86400000;

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

function formatPercent(value: number): string {
  return `${Math.round(value * 100) / 100}%`;
}

function parseNumberInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getOwnerPayoutLabel(workContext: FinanceWorkContext): string {
  switch (workContext) {
    case "malmo_studio":
      return "Pay Diamant owner";
    case "copenhagen_studio":
      return "Pay Good Morning";
    case "guest_spot":
      return "Guest-spot fee reserve";
    case "private_home":
      return "Private / home fee reserve";
  }
}

function getInvoiceAgeDays(paymentDate: string): number {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const paymentTime = new Date(`${paymentDate}T00:00:00`).getTime();
  return Math.max(0, Math.floor((todayStart - paymentTime) / DAY_IN_MS));
}

function getInvoiceAgeLabel(ageDays: number): string {
  if (ageDays >= 14) return `${ageDays}d old · urgent`;
  if (ageDays >= 7) return `${ageDays}d old · due soon`;
  if (ageDays >= 3) return `${ageDays}d old · watch it`;
  if (ageDays === 0) return "today";
  return `${ageDays}d old`;
}

function getInvoiceAgeTone(ageDays: number): string {
  if (ageDays >= 14) return "bg-red-100 text-red-700";
  if (ageDays >= 7) return "bg-amber-100 text-amber-700";
  if (ageDays >= 3) return "bg-yellow-100 text-yellow-700";
  return "bg-[var(--sabbia-100)] text-foreground-muted";
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return "Never nudged";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(
  fileName: string,
  rows: Array<Record<string, string | number | null | undefined>>
) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
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
    studio_fee_base_amount: "",
    studio_fee_base_currency: currency,
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

function CollapsibleFinanceSection({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="rounded-3xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm" open={defaultOpen}>
      <summary className="cursor-pointer list-none">
        <div className="pr-8">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink-900">{title}</h2>
          <p className="mt-1 text-sm text-foreground-muted">{description}</p>
        </div>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
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
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [sessionTotalAmount, setSessionTotalAmount] = useState("");
  const [form, setForm] = useState<FinanceFormState>(
    buildDefaultFormState(null, DEFAULT_MONTH)
  );
  const [expenseForm, setExpenseForm] = useState<VariableExpenseFormState>({
    expense_date: `${DEFAULT_MONTH}-01`,
    label: "",
    category: "supplies",
    amount: "",
    currency: "EUR",
    notes: "",
  });

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
  const bookings = useMemo(() => dashboard?.bookings ?? [], [dashboard?.bookings]);
  const invoiceReminders = useMemo(
    () => dashboard?.invoice_reminders ?? [],
    [dashboard?.invoice_reminders]
  );
  const previousMonth = useMemo(() => getPreviousMonthKey(month), [month]);

  const monthlyProjects = useMemo(
    () =>
      (dashboard?.projects ?? []).map((project) => ({
        ...project,
        payments: project.payments.filter((payment) => payment.payment_date.startsWith(month)),
      })),
    [dashboard?.projects, month]
  );
  const monthlyVariableExpenses = useMemo(
    () =>
      (dashboard?.variable_expenses ?? []).filter((expense) => expense.expense_date.startsWith(month)),
    [dashboard?.variable_expenses, month]
  );

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === form.booking_id) ?? null,
    [bookings, form.booking_id]
  );
  const selectedBookingDeposit = selectedBooking?.deposit_amount ?? 0;
  const selectedBookingCurrency = selectedBooking
    ? selectedBooking.location === "copenhagen"
      ? "DKK"
      : "SEK"
    : null;
  const sessionTotalNumber = parseNumberInput(sessionTotalAmount);
  const depositRemainder =
    sessionTotalNumber !== null && selectedBookingDeposit > 0
      ? Math.max(0, sessionTotalNumber - selectedBookingDeposit)
      : null;
  const depositHelperReady =
    selectedBookingDeposit > 0 &&
    selectedBookingCurrency !== null &&
    selectedBookingCurrency === form.currency;

  const taxSummary = summary?.tax_summary ?? null;
  const fixedCostSummary = summary?.fixed_costs ?? null;
  const keepSummary = summary?.keep_summary ?? null;
  const variableExpenseSummary = summary?.variable_expenses ?? null;
  const italySimulation = taxSummary?.simulations.italy ?? null;
  const swedenSimulation = taxSummary?.simulations.sweden ?? null;

  useEffect(() => {
    setSessionTotalAmount("");
  }, [form.booking_id]);

  const reportingBucketCurrencies = useMemo(
    () =>
      REPORTING_CURRENCIES.filter((currency) => {
        if (!summary) return false;
        return (
          summary.net_totals_by_reporting_currency[currency] > 0 ||
          summary.studio_fee_totals_by_reporting_currency[currency] > 0 ||
          summary.processor_fee_approx_totals_by_reporting_currency[currency] > 0
        );
      }),
    [summary]
  );

  const trendMax = useMemo(() => {
    const points = summary?.monthly_trend ?? [];
    return points.reduce((max, point) => Math.max(max, point.net_total), 0);
  }, [summary?.monthly_trend]);

  const ownerPayoutRows = useMemo(() => {
    if (!summary || !dashboard) return [];

    return summary.fee_totals_by_context
      .filter((row) => row.fee_total > 0)
      .map((row) => ({
        ...row,
        label: getOwnerPayoutLabel(row.work_context),
        contextLabel: getContextLabel(row.work_context, dashboard.context_settings),
      }));
  }, [dashboard, summary]);

  const invoiceReminderGroups = useMemo(
    () =>
      invoiceReminders.map((payment) => {
        const ageDays = getInvoiceAgeDays(payment.payment_date);
        return {
          ...payment,
          ageDays,
          ageLabel: getInvoiceAgeLabel(ageDays),
          ageTone: getInvoiceAgeTone(ageDays),
        };
      }),
    [invoiceReminders]
  );

  const monthlyPayoutHistory = useMemo(() => {
    if (!summary || !dashboard) return [];

    return summary.monthly_context_payouts.map((row) => ({
      ...row,
      payoutLabel: getOwnerPayoutLabel(row.work_context),
      contextLabel: getContextLabel(row.work_context, dashboard.context_settings),
    }));
  }, [dashboard, summary]);

  const latestTrendPoint = summary?.monthly_trend.at(-1) ?? null;
  const previousTrendPoint =
    summary && summary.monthly_trend.length > 1
      ? summary.monthly_trend[summary.monthly_trend.length - 2]
      : null;

  const invoiceBacklogDelta = useMemo(() => {
    if (!latestTrendPoint || !previousTrendPoint) return null;
    return latestTrendPoint.open_invoice_count - previousTrendPoint.open_invoice_count;
  }, [latestTrendPoint, previousTrendPoint]);

  const monthlyPulseExportRows = useMemo(() => {
    if (!summary) return [];

    return summary.monthly_trend.map((point) => ({
      month: point.month,
      label: point.label,
      primary_currency: summary.approx_primary.currency,
      net_total: point.net_total,
      studio_fee_total: point.studio_fee_total,
      processor_fee_total: point.processor_fee_total,
      open_invoice_count: point.open_invoice_count,
    }));
  }, [summary]);

  const payoutHistoryExportRows = useMemo(
    () =>
      monthlyPayoutHistory.map((row) => ({
        month: row.month,
        label: row.label,
        payout_label: row.payoutLabel,
        context: row.contextLabel,
        reporting_currency: row.reporting_currency,
        fee_total: row.fee_total,
        processor_fee_total: row.processor_fee_total,
        entry_count: row.entry_count,
      })),
    [monthlyPayoutHistory]
  );

  const reminderExportRows = useMemo(
    () =>
      invoiceReminderGroups.map((payment) => ({
        client_name: payment.client_name,
        project_label: payment.project_label,
        payment_date: payment.payment_date,
        age_days: payment.ageDays,
        age_label: payment.ageLabel,
        payment_method: FINANCE_PAYMENT_METHOD_LABELS[payment.payment_method],
        reporting_currency: payment.reporting_currency,
        gross_reporting: payment.gross_amount_reporting,
        studio_fee_reporting: payment.fee_amount,
        processor_fee_currency: payment.processor_fee_currency,
        processor_fee_amount: payment.processor_fee_amount,
        take_home_reporting: payment.net_amount,
        invoice_reference: payment.invoice_reference,
        last_nudged: payment.invoice_last_nudged_at,
        reminder_note: payment.invoice_reminder_note,
      })),
    [invoiceReminderGroups]
  );

  function resetForm(nextMonth = month, nextDashboard = dashboard) {
    setForm(buildDefaultFormState(nextDashboard, nextMonth));
    setSessionTotalAmount("");
  }

  function resetExpenseForm(nextDashboard = dashboard, nextMonth = month) {
    setExpenseForm({
      expense_date: `${nextMonth}-01`,
      label: "",
      category: "supplies",
      amount: "",
      currency: nextDashboard?.settings.reporting_currency_primary ?? "EUR",
      notes: "",
    });
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
        next.studio_fee_base_currency = defaultCurrency;
        next.fee_percentage = String(
          getContextFeeDefault(workContext, dashboard.context_settings)
        );
      }

      if (key === "payment_method" && dashboard) {
        const method = value as FinancePaymentMethod;
        const needsInvoice = method === "card" && dashboard.settings.card_invoice_default;
        const actualFramework = dashboard.settings.active_tax_framework ?? "italy";
        next.invoice_needed = needsInvoice;
        next.invoice_done = needsInvoice ? next.invoice_done : false;
        next.processor_fee_percentage =
          method === "card"
            ? String(
                dashboard.settings.card_processor_fee_percentage ??
                  DEFAULT_CARD_PROCESSOR_FEE_PERCENTAGE
              )
            : "0";

        if (method === "card") {
          next.currency = actualFramework === "italy" ? "EUR" : next.reporting_currency;
          next.studio_fee_base_currency = next.reporting_currency;
        }
      }

      if (key === "invoice_needed" && !value) {
        next.invoice_done = false;
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
          studio_fee_base_amount: form.studio_fee_base_amount
            ? Number(form.studio_fee_base_amount)
            : null,
          studio_fee_base_currency: form.studio_fee_base_amount
            ? form.studio_fee_base_currency
            : null,
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

  async function handleCreateExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_type: "variable_expense",
          expense_date: expenseForm.expense_date,
          label: expenseForm.label,
          category: expenseForm.category,
          amount: Number(expenseForm.amount),
          currency: expenseForm.currency,
          notes: expenseForm.notes || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create expense");
      }

      setDashboard(data as FinanceDashboardResponse);
      setShowExpenseForm(false);
      resetExpenseForm(data as FinanceDashboardResponse, month);
      setSuccess("Expense added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create expense");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExpense(id: string) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/finance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_type: "variable_expense",
          action: "delete",
          id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete expense");
      }

      setDashboard(data as FinanceDashboardResponse);
      setSuccess("Expense removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete expense");
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

  async function handleUpdateReminder(
    paymentId: string,
    updates: {
      invoice_last_nudged_at?: string | null;
      invoice_reminder_note?: string | null;
    },
    successMessage: string
  ) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/finance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: paymentId,
          ...updates,
        }),
      });

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update reminder");
      }

      setDashboard(data as FinanceDashboardResponse);
      setSuccess(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update reminder");
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
            <span className="text-foreground-muted">Approx card-fee impact</span>
            <span className="text-foreground">
              {formatMoney(summary.processor_fee_approx_totals_by_reporting_currency[currency], currency)}
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

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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
          label="SumUp fees"
          value={
            loading || !summary
              ? "..."
              : formatMoney(summary.processor_fee_totals_by_processor_currency.EUR, "EUR")
          }
          detail="Raw processor fees stay in EUR because Lia's SumUp account settles through Italy."
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
      </div>

      <div className="mb-6">
        <AdminSurface>
          <AdminSectionHeading
            title="Estimated keep from invoiced work"
            description="This is the practical answer Lia needs first: from invoiced work this month, roughly how much remains after studio fees, SumUp drag, tax reserve, and fixed-cost reserve under the active model and the projections."
          />

          {loading || !summary || !keepSummary ? (
            <p className="text-sm text-foreground-muted">Loading keep estimate...</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                  Current month invoiced base
                </p>
                <div className="mt-2 text-xl font-medium text-foreground sm:text-2xl">
                  {keepSummary.invoiced_payment_count} invoiced payment{keepSummary.invoiced_payment_count === 1 ? "" : "s"}
                </div>
                <p className="mt-2 text-xs text-foreground-muted">
                  {keepSummary.excluded_payment_count} payment{keepSummary.excluded_payment_count === 1 ? "" : "s"} excluded because invoice is not done yet.
                </p>
                <p className="mt-1 text-xs text-foreground-muted">
                  Variable expenses this month: {formatMoney(keepSummary.variable_expense_total, keepSummary.currency)}
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {Object.values(keepSummary.scenarios).map((scenario) => (
                  <div
                    key={scenario.key}
                    className={`rounded-2xl border p-4 ${scenario.active ? "border-[var(--ink-900)] bg-white shadow-sm" : "border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                          {scenario.active ? "Active model" : "Projection"}
                        </p>
                        <p className="mt-2 font-medium text-foreground">{scenario.label}</p>
                        <p className="mt-1 text-xs text-foreground-muted">Shown in {scenario.currency}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-foreground-muted shadow-sm">
                        {FINANCE_TAX_FRAMEWORK_LABELS[scenario.framework]}
                      </span>
                    </div>

                    <div className="mt-4 text-xl font-medium text-foreground sm:text-2xl">
                      {formatMoney(scenario.estimated_keep, scenario.currency)}
                    </div>

                    <div className="mt-4 space-y-2 text-xs text-foreground-muted">
                      <div className="flex items-center justify-between gap-3">
                        <span>Invoiced gross</span>
                        <span>{formatMoney(scenario.invoiced_gross, scenario.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Studio fees</span>
                        <span>{formatMoney(scenario.studio_fees, scenario.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Processor fees</span>
                        <span>{formatMoney(scenario.processor_fees, scenario.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Tax reserve</span>
                        <span>{formatMoney(scenario.tax_reserve, scenario.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Fixed-cost reserve</span>
                        <span>{formatMoney(scenario.fixed_cost_reserve, scenario.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Variable expenses</span>
                        <span>{formatMoney(scenario.variable_expense_reserve, scenario.currency)}</span>
                      </div>
                    </div>

                    <p className="mt-4 text-xs text-foreground-muted">
                      Reserve rate {formatPercent(scenario.reserve_rate)}
                      {scenario.missing_fixed_cost_count > 0
                        ? ` · ${scenario.missing_fixed_cost_count} fixed cost amount${scenario.missing_fixed_cost_count === 1 ? "" : "s"} still missing`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </AdminSurface>
      </div>

      <div className="mb-6">
        <AdminSurface>
          <AdminSectionHeading
            title="Fixed business costs"
            description="Recurring overhead stays standardized here. Missing amounts stay visible so totals remain honest instead of pretending the unknowns do not exist."
          />

          {loading || !summary || !fixedCostSummary ? (
            <p className="text-sm text-foreground-muted">Loading fixed cost reserve...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                    Configured annual reserve
                  </p>
                  <div className="mt-2 text-xl font-medium text-foreground sm:text-2xl">
                    {formatMoney(fixedCostSummary.annual_total_primary, summary.approx_primary.currency)}
                  </div>
                  <p className="mt-2 text-xs text-foreground-muted">
                    {fixedCostSummary.configured_count} cost line{fixedCostSummary.configured_count === 1 ? "" : "s"} with known amounts
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                    Missing data
                  </p>
                  <div className="mt-2 text-xl font-medium text-foreground sm:text-2xl">
                    {fixedCostSummary.missing_amount_count}
                  </div>
                  <p className="mt-2 text-xs text-foreground-muted">
                    Missing fixed-cost amount{fixedCostSummary.missing_amount_count === 1 ? "" : "s"}. They stay excluded from totals until filled in.
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                    Due this month
                  </p>
                  <div className="mt-2 text-xl font-medium text-foreground sm:text-2xl">
                    {fixedCostSummary.due_soon.length}
                  </div>
                  <p className="mt-2 text-xs text-foreground-muted">
                    Obligation{fixedCostSummary.due_soon.length === 1 ? "" : "s"} scheduled in {formatMonthLabel(month)}
                  </p>
                </div>
              </div>

              {fixedCostSummary.due_soon.length > 0 ? (
                <div className="space-y-3">
                  {fixedCostSummary.due_soon.map((cost) => (
                    <div
                      key={cost.id}
                      className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{cost.label}</p>
                          <p className="mt-1 text-xs text-foreground-muted">
                            {cost.cadence} cost due in this month
                          </p>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {cost.amount === null ? "Amount pending" : formatMoney(cost.amount, cost.currency)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </AdminSurface>
      </div>

      <div className="mb-6">
        <AdminSurface>
          <AdminSectionHeading
            title="Variable business expenses"
            description="Track flexible work costs like needles, ink, supplies, and travel by month. They reduce the keep estimate without forcing Lia into item-by-item accounting hell."
            action={
              <AdminButton
                variant={showExpenseForm ? "ghost" : "secondary"}
                onClick={() => {
                  setShowExpenseForm((current) => !current);
                  if (!showExpenseForm) resetExpenseForm();
                }}
              >
                {showExpenseForm ? "Hide expense form" : "Add expense"}
              </AdminButton>
            }
          />

          {showExpenseForm ? (
            <form className="grid gap-4" onSubmit={handleCreateExpense}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                <label className="text-sm text-foreground-muted">
                  Expense date
                  <input
                    type="date"
                    value={expenseForm.expense_date}
                    onChange={(event) =>
                      setExpenseForm((current) => ({ ...current, expense_date: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                    style={{ fontSize: "16px" }}
                    required
                  />
                </label>

                <label className="text-sm text-foreground-muted">
                  Label
                  <input
                    value={expenseForm.label}
                    onChange={(event) =>
                      setExpenseForm((current) => ({ ...current, label: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                    style={{ fontSize: "16px" }}
                    placeholder="Example: cartridge needles"
                    required
                  />
                </label>

                <label className="text-sm text-foreground-muted">
                  Category
                  <select
                    value={expenseForm.category}
                    onChange={(event) =>
                      setExpenseForm((current) => ({
                        ...current,
                        category: event.target.value as FinanceVariableExpenseCategory,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                    style={{ fontSize: "16px" }}
                  >
                    {FINANCE_VARIABLE_EXPENSE_CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>
                        {FINANCE_VARIABLE_EXPENSE_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-foreground-muted">
                  Amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(event) =>
                      setExpenseForm((current) => ({ ...current, amount: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                    style={{ fontSize: "16px" }}
                    required
                  />
                </label>

                <label className="text-sm text-foreground-muted">
                  Currency
                  <select
                    value={expenseForm.currency}
                    onChange={(event) =>
                      setExpenseForm((current) => ({
                        ...current,
                        currency: event.target.value as FinanceCurrency,
                      }))
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

              <label className="text-sm text-foreground-muted">
                Notes
                <input
                  value={expenseForm.notes}
                  onChange={(event) =>
                    setExpenseForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                  style={{ fontSize: "16px" }}
                  placeholder="Optional supplier, shop, or context note"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <AdminButton type="submit" variant="primary" disabled={saving}>
                  {saving ? "Saving..." : "Save expense"}
                </AdminButton>
                <AdminButton
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    resetExpenseForm();
                    setShowExpenseForm(false);
                  }}
                >
                  Cancel
                </AdminButton>
              </div>
            </form>
          ) : null}

          {loading || !summary || !variableExpenseSummary ? (
            <p className="text-sm text-foreground-muted">Loading variable expenses...</p>
          ) : variableExpenseSummary.entry_count > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                    Month total
                  </p>
                  <div className="mt-2 text-xl font-medium text-foreground sm:text-2xl">
                    {formatMoney(variableExpenseSummary.month_total_primary, summary.approx_primary.currency)}
                  </div>
                  <p className="mt-2 text-xs text-foreground-muted">
                    {variableExpenseSummary.entry_count} expense entr{variableExpenseSummary.entry_count === 1 ? "y" : "ies"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {variableExpenseSummary.by_category.map((row) => (
                  <div
                    key={row.category}
                    className="rounded-2xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {FINANCE_VARIABLE_EXPENSE_CATEGORY_LABELS[row.category]}
                        </p>
                        <p className="mt-1 text-xs text-foreground-muted">
                          {row.entry_count} entr{row.entry_count === 1 ? "y" : "ies"}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {formatMoney(row.total_primary, summary.approx_primary.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {monthlyVariableExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{expense.label}</p>
                        <p className="mt-1 text-xs text-foreground-muted">
                          {expense.expense_date} · {FINANCE_VARIABLE_EXPENSE_CATEGORY_LABELS[expense.category]}
                        </p>
                        {expense.notes ? (
                          <p className="mt-1 text-xs text-foreground-muted">{expense.notes}</p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">
                          {formatMoney(expense.amount, expense.currency)}
                        </p>
                        <div className="mt-2">
                          <AdminButton
                            variant="ghost"
                            className="!min-h-[32px] !px-3 !py-1 text-xs"
                            disabled={saving}
                            onClick={() => handleDeleteExpense(expense.id)}
                          >
                            Remove
                          </AdminButton>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">
              No variable expenses logged for {formatMonthLabel(month)} yet.
            </p>
          )}
        </AdminSurface>
      </div>

      {showForm ? (
        <AdminSurface className="mb-6">
          <AdminSectionHeading
            title="Quick finance entry"
            description="Keep the required fields brutally short, then let Lia override the defaults only when reality demands it."
          />

          <form className="grid gap-5" onSubmit={handleCreateEntry}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
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
                Payment amount received
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
                {selectedBookingDeposit > 0 ? (
                  <span className="mt-1 block text-xs text-foreground-muted">
                    Enter the actual amount paid in this transaction. If the booking had a non-invoiced deposit, this should usually be the remainder, not the full tattoo price.
                  </span>
                ) : null}
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

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {selectedBookingDeposit > 0 ? (
                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4 md:col-span-2 xl:col-span-4">
                  <p className="text-sm font-medium text-foreground">Booking deposit helper</p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    Deposit on this booking: {formatMoney(selectedBookingDeposit, selectedBookingCurrency ?? form.currency)}. If you know the full session total, enter it here and use the helper to fill the payable remainder.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                    <label className="text-sm text-foreground-muted">
                      Full session total in {selectedBookingCurrency}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={sessionTotalAmount}
                        onChange={(event) => setSessionTotalAmount(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                        style={{ fontSize: "16px" }}
                        placeholder="Example: 2000"
                      />
                    </label>

                    <div className="flex items-end">
                      <AdminButton
                        type="button"
                        variant="secondary"
                        disabled={!depositHelperReady || depositRemainder === null}
                        onClick={() => {
                          if (depositRemainder === null) return;
                          updateForm("gross_amount", String(depositRemainder));
                        }}
                      >
                        Use remaining payment
                      </AdminButton>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-foreground-muted">
                    <p>
                      Formula: {sessionTotalNumber !== null
                        ? `${sessionTotalNumber} - ${selectedBookingDeposit} = ${depositRemainder ?? 0}`
                        : `full total - ${selectedBookingDeposit} = remainder`}{" "}
                      {selectedBookingCurrency}
                    </p>
                    {depositHelperReady ? null : (
                      <p>
                        Switch payment currency back to {selectedBookingCurrency} to use this helper safely.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {form.payment_method === "card" ? (
                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4 md:col-span-2 xl:col-span-4">
                  <p className="text-sm font-medium text-foreground">Card payment helper</p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    Keep tax and SumUp tied to the actual charged amount. If Lia later uses a different local base to calculate the studio share, set that separately here.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    <label className="text-sm text-foreground-muted">
                      Charged card amount
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.gross_amount}
                        onChange={(event) => updateForm("gross_amount", event.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                        style={{ fontSize: "16px" }}
                      />
                    </label>

                    <label className="text-sm text-foreground-muted">
                      Charge currency
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
                      Studio fee base
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.studio_fee_base_amount}
                        onChange={(event) =>
                          updateForm("studio_fee_base_amount", event.target.value)
                        }
                        placeholder="Optional local base"
                        className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                        style={{ fontSize: "16px" }}
                      />
                    </label>

                    <label className="text-sm text-foreground-muted">
                      Studio fee base currency
                      <select
                        value={form.studio_fee_base_currency}
                        onChange={(event) =>
                          updateForm("studio_fee_base_currency", event.target.value as FinanceCurrency)
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

                  <p className="mt-3 text-xs text-foreground-muted">
                    Example: client sticker price is `2000 SEK`, Lia charges `185 EUR`, then later pays the studio using whatever local rounded base she decides. Tax and SumUp follow `185 EUR`; studio share follows the local base if you fill it here.
                  </p>
                </div>
              ) : null}

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

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
                {selectedBooking?.deposit_amount ? (
                  <p className="mt-1">
                    Linked booking deposit: {selectedBooking.deposit_amount}{" "}
                    {selectedBooking.location === "copenhagen" ? "DKK" : "SEK"}. Best practice: enter only the remainder here if the PayPal deposit stays non-invoiced.
                  </p>
                ) : null}
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
                    disabled={!form.invoice_needed}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      updateForm("invoice_needed", checked ? true : form.invoice_needed);
                      updateForm("invoice_done", checked);
                    }}
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
        <CollapsibleFinanceSection
          title="Reporting buckets"
          description="Top cards show the overview. These buckets show the honest monthly breakdown by studio/context currency."
        >

          {loading ? (
            <p className="text-sm text-foreground-muted">Loading reporting buckets...</p>
          ) : summary ? (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-3">
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
        </CollapsibleFinanceSection>

        <CollapsibleFinanceSection
          title="Weekly view"
          description="Quick weekly visibility so month-end math doesn’t hide a dead or unusually strong week."
        >

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
        </CollapsibleFinanceSection>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <CollapsibleFinanceSection
          title="Owner payouts"
          description="This is the operational bit Lia actually needs at month end: who gets paid, in which local currency, and roughly how much processor drag hit that bucket."
        >

          {loading ? (
            <p className="text-sm text-foreground-muted">Loading payout summary...</p>
          ) : ownerPayoutRows.length > 0 ? (
            <div className="space-y-3">
              {ownerPayoutRows.map((row) => (
                <div
                  key={`${row.work_context}:${row.reporting_currency}:owner-payout`}
                  className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{row.label}</p>
                      <p className="mt-1 text-xs text-foreground-muted">
                        {row.contextLabel} · {row.entry_count} payment{row.entry_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {formatMoney(row.fee_total, row.reporting_currency)}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-foreground-muted sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3">
                      <span>Gross handled</span>
                      <span>{formatMoney(row.gross_total, row.reporting_currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Approx SumUp drag</span>
                      <span>{formatMoney(row.processor_fee_total, row.reporting_currency)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">
              No owner payouts accumulated for {formatMonthLabel(month)} yet.
            </p>
          )}
        </CollapsibleFinanceSection>

        <CollapsibleFinanceSection
          title={italySimulation?.label ?? "Italy tax model"}
          description="Yearly tax simulation for the selected year. Only payments marked `invoice_done = true` are included, so non-invoiced deposits stay out of this on purpose."
        >

          {loading || !summary || !taxSummary || !italySimulation ? (
            <p className="text-sm text-foreground-muted">Loading tax simulation...</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                  Estimated yearly net after Italy model
                </p>
                <div className="mt-2 text-xl font-medium text-foreground sm:text-2xl">
                  {formatMoney(italySimulation.net_income, italySimulation.currency)}
                </div>
                <p className="mt-2 text-xs text-foreground-muted">
                  Revenue {formatMoney(italySimulation.invoiced_revenue, italySimulation.currency)} · social contributions {formatMoney(italySimulation.social_contributions, italySimulation.currency)} · tax {formatMoney(italySimulation.income_tax, italySimulation.currency)}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                    Simulation basis
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    {italySimulation.invoiced_payment_count} invoiced payment{italySimulation.invoiced_payment_count === 1 ? "" : "s"} in {taxSummary.tax_year}
                  </p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    Taxable profit {formatMoney(italySimulation.taxable_profit, italySimulation.currency)} · effective rate {formatPercent(italySimulation.effective_tax_rate)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                    Actual framework status
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    {italySimulation.active ? "This is the current active model" : `Current active model: ${FINANCE_TAX_FRAMEWORK_LABELS[taxSummary.actual_framework]}`}
                  </p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {italySimulation.notes.join(" · ")}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-[var(--sabbia-50)] px-4 py-3 text-xs text-foreground-muted">
                Deposit rule: PayPal booking deposits that are never invoiced should stay out of this model. Enter the final card or transfer remainder as its own payment line and mark that one invoiced when done.
              </div>
            </div>
          )}
        </CollapsibleFinanceSection>
      </div>

      <div className="mb-6">
        <CollapsibleFinanceSection
          title={swedenSimulation?.label ?? "Sweden tax model"}
          description="Comparison model for a Sweden setup. It uses the same invoiced-only yearly base, so deposits and non-invoiced cash stay outside the tax math."
        >

          {loading || !summary || !taxSummary || !swedenSimulation || !italySimulation ? (
            <p className="text-sm text-foreground-muted">Loading Sweden simulation...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                    Estimated yearly net after Sweden model
                  </p>
                  <div className="mt-2 text-xl font-medium text-foreground sm:text-2xl">
                    {formatMoney(swedenSimulation.net_income, swedenSimulation.currency)}
                  </div>
                  <p className="mt-2 text-xs text-foreground-muted">
                    Revenue {formatMoney(swedenSimulation.invoiced_revenue, swedenSimulation.currency)} · social contributions {formatMoney(swedenSimulation.social_contributions, swedenSimulation.currency)} · tax {formatMoney(swedenSimulation.income_tax, swedenSimulation.currency)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                    Comparison snapshot
                  </p>
                  <div className="mt-3 grid gap-2 text-sm text-foreground-muted">
                    <div className="flex items-center justify-between gap-3">
                      <span>Invoiced base</span>
                      <span className="font-medium text-foreground">
                        {formatMoney(taxSummary.invoiced_revenue_primary, summary.approx_primary.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{italySimulation.label}</span>
                      <span className="font-medium text-foreground">
                        {formatMoney(italySimulation.net_income, italySimulation.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{swedenSimulation.label}</span>
                      <span className="font-medium text-foreground">
                        {formatMoney(swedenSimulation.net_income, swedenSimulation.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                    Sweden assumptions
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    Effective rate {formatPercent(swedenSimulation.effective_tax_rate)}
                  </p>
                  <p className="mt-1 text-sm text-foreground-muted">{swedenSimulation.notes.join(" · ")}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                    Booking deposit rule
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    Deposits are cashflow, not automatic tax base
                  </p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    If a booking starts with a non-invoiced PayPal deposit, only the later invoiced remainder belongs in this comparison.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CollapsibleFinanceSection>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <CollapsibleFinanceSection
          title="Monthly finance pulse"
          description="Seasonality in one place: take-home, studio drag, SumUp drag, and open invoice backlog across the last six months."
        >
          <div className="mb-4 flex justify-end">
            <AdminButton
              variant="secondary"
              onClick={() =>
                downloadCsv(`finance-monthly-pulse-${month}.csv`, monthlyPulseExportRows)
              }
              disabled={monthlyPulseExportRows.length === 0}
            >
              Export CSV
            </AdminButton>
          </div>

          {loading || !summary ? (
            <p className="text-sm text-foreground-muted">Loading monthly pulse...</p>
          ) : summary.monthly_trend.length > 0 ? (
            <div className="space-y-3">
              {summary.monthly_trend.map((point) => (
                <div
                  key={`${point.month}:seasonality`}
                  className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{point.label}</p>
                      <p className="mt-1 text-xs text-foreground-muted">
                        {point.open_invoice_count} open invoice{point.open_invoice_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {formatMoney(point.net_total, summary.approx_primary.currency)}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-foreground-muted sm:grid-cols-3">
                    <div className="flex items-center justify-between gap-3">
                      <span>Studio fees</span>
                      <span>
                        {formatMoney(point.studio_fee_total, summary.approx_primary.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>SumUp drag</span>
                      <span>
                        {formatMoney(point.processor_fee_total, summary.approx_primary.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Invoice backlog</span>
                      <span>{point.open_invoice_count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">
              Seasonality will show up after a few months of finance entries.
            </p>
          )}
        </CollapsibleFinanceSection>

        <CollapsibleFinanceSection
          title="Backlog trend"
          description="Simple period-over-period read on invoice backlog so Lia can see if admin debt is shrinking or breeding."
        >

          {loading || !summary || !latestTrendPoint ? (
            <p className="text-sm text-foreground-muted">Loading backlog trend...</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                  Current month backlog
                </p>
                <div className="mt-2 text-xl font-medium text-foreground sm:text-2xl">
                  {latestTrendPoint.open_invoice_count}
                </div>
                <p className="mt-2 text-xs text-foreground-muted">
                  {previousTrendPoint
                    ? invoiceBacklogDelta === 0
                      ? "Flat vs previous month"
                      : `${invoiceBacklogDelta && invoiceBacklogDelta > 0 ? "+" : ""}${invoiceBacklogDelta} vs ${previousTrendPoint.label}`
                    : "No previous month yet"}
                </p>
              </div>
              <div className="space-y-2">
                {summary.monthly_trend.map((point) => (
                  <div
                    key={`${point.month}:backlog`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"
                  >
                    <span className="text-sm text-foreground">{point.label}</span>
                    <span className="text-sm text-foreground-muted">
                      {point.open_invoice_count} open invoice{point.open_invoice_count === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleFinanceSection>
      </div>

      <div className="mb-6">
        <CollapsibleFinanceSection
          title="Owner payout history"
          description="A six-month view of what each studio owner or context reserve needed per month, with approximate SumUp drag attached to that month’s bucket."
        >
          <div className="mb-4 flex justify-end">
            <AdminButton
              variant="secondary"
              onClick={() =>
                downloadCsv(`finance-owner-payout-history-${month}.csv`, payoutHistoryExportRows)
              }
              disabled={payoutHistoryExportRows.length === 0}
            >
              Export CSV
            </AdminButton>
          </div>

          {loading ? (
            <p className="text-sm text-foreground-muted">Loading payout history...</p>
          ) : monthlyPayoutHistory.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--sabbia-200)]">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-[var(--sabbia-50)] text-foreground-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Month</th>
                    <th className="px-4 py-3 font-medium">Payout</th>
                    <th className="px-4 py-3 font-medium">Context</th>
                    <th className="px-4 py-3 font-medium">Fee total</th>
                    <th className="px-4 py-3 font-medium">Approx SumUp drag</th>
                    <th className="px-4 py-3 font-medium">Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyPayoutHistory.map((row) => (
                    <tr
                      key={`${row.month}:${row.work_context}:${row.reporting_currency}:history`}
                      className="border-t border-[var(--sabbia-200)] bg-white"
                    >
                      <td className="px-4 py-3 text-foreground">{row.label}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{row.payoutLabel}</td>
                      <td className="px-4 py-3 text-foreground-muted">
                        {row.contextLabel} · {row.reporting_currency}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {formatMoney(row.fee_total, row.reporting_currency)}
                      </td>
                      <td className="px-4 py-3 text-foreground-muted">
                        {formatMoney(row.processor_fee_total, row.reporting_currency)}
                      </td>
                      <td className="px-4 py-3 text-foreground-muted">{row.entry_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">
              Owner payout history will start filling out after more months of data.
            </p>
          )}
        </CollapsibleFinanceSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <CollapsibleFinanceSection
            title="Studio / context totals"
            description="Grouped by actual working context and native reporting bucket, so Malmö and Copenhagen stop bleeding into a fake currency view."
          >

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
                      <th className="px-4 py-3 font-medium">Card fee impact</th>
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
          </CollapsibleFinanceSection>

          <CollapsibleFinanceSection
            title="Projects this month"
            description="Each payment shows studio-settlement numbers in the local bucket plus the raw SumUp fee in EUR, so the money trail matches reality."
            defaultOpen
          >

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
                                  Gross {formatMoney(payment.gross_amount_reporting, payment.reporting_currency)}
                                </p>
                                <p className="text-foreground-muted">
                                  Studio fee {formatMoney(payment.fee_amount, payment.reporting_currency)}
                                </p>
                                <p className="text-foreground-muted">
                                  Card fee {formatMoney(payment.processor_fee_amount, payment.processor_fee_currency)}
                                </p>
                                <p className="font-medium text-foreground">
                                  Take-home {formatMoney(payment.net_amount, payment.reporting_currency)}
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
          </CollapsibleFinanceSection>
        </div>

        <div className="space-y-6">
          <CollapsibleFinanceSection
            title="Last 6 months"
            description="Take-home trend in the primary reporting currency, so the direction of travel is obvious at a glance."
          >

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
          </CollapsibleFinanceSection>

          <AdminSurface>
            <AdminSectionHeading
              title="Invoice reminders"
              description="Card payments should still nudge Lia to invoice, now with simple age-based urgency instead of a polite little graveyard."
              action={
                <AdminButton
                  variant="secondary"
                  onClick={() =>
                    downloadCsv(`finance-invoice-reminders-${month}.csv`, reminderExportRows)
                  }
                  disabled={reminderExportRows.length === 0}
                >
                  Export CSV
                </AdminButton>
              }
            />

            {loading ? (
              <p className="text-sm text-foreground-muted">Loading reminders...</p>
            ) : invoiceReminderGroups.length > 0 ? (
              <div className="space-y-3">
                {invoiceReminderGroups.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-foreground">{payment.client_name}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] ${payment.ageTone}`}>
                        {payment.ageLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground-muted">
                      {payment.project_label} · {payment.payment_date} · {FINANCE_PAYMENT_METHOD_LABELS[payment.payment_method]}
                    </p>
                    <div className="mt-2 grid gap-1 text-xs text-foreground-muted">
                      <p>Gross {formatMoney(payment.gross_amount_reporting, payment.reporting_currency)}</p>
                      <p>Studio fee {formatMoney(payment.fee_amount, payment.reporting_currency)}</p>
                      <p>Card fee {formatMoney(payment.processor_fee_amount, payment.processor_fee_currency)}</p>
                      <p>Last nudged {formatTimestamp(payment.invoice_last_nudged_at)}</p>
                    </div>
                    <label className="mt-3 block text-xs text-foreground-muted">
                      Reminder note
                      <textarea
                        defaultValue={payment.invoice_reminder_note ?? ""}
                        placeholder="Optional note like 'sent on WhatsApp' or 'waiting for VAT details'"
                        className="mt-1 min-h-[84px] w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-foreground"
                        style={{ fontSize: "16px" }}
                        onBlur={(event) => {
                          const nextValue = event.target.value.trim();
                          if ((payment.invoice_reminder_note ?? "") === nextValue) return;
                          handleUpdateReminder(
                            payment.id,
                            { invoice_reminder_note: nextValue || null },
                            nextValue ? "Reminder note saved." : "Reminder note cleared."
                          );
                        }}
                      />
                    </label>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-foreground-muted">
                        Take-home {formatMoney(payment.net_amount, payment.reporting_currency)}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <AdminButton
                          variant="secondary"
                          className="!min-h-[32px] !px-3 !py-1 text-xs"
                          onClick={() =>
                            handleUpdateReminder(
                              payment.id,
                              { invoice_last_nudged_at: new Date().toISOString() },
                              "Reminder marked as nudged."
                            )
                          }
                        >
                          Nudged today
                        </AdminButton>
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
