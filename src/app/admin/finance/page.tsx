"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  FinanceTaxFramework,
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
  studio_fee_base_currency: FinanceCurrency | "";
  processor_fee_percentage: string;
  invoice_needed: boolean;
  invoice_done: boolean;
  invoice_reference: string;
  project_notes: string;
  payment_notes: string;
};

type VariableExpenseFormState = {
  id?: string;
  expense_date: string;
  label: string;
  category: FinanceVariableExpenseCategory;
  amount: string;
  currency: FinanceCurrency;
  notes: string;
};

type EditingFinanceEntry = {
  projectId: string;
  paymentId: string;
};

type FinanceWorkspaceView = "operations" | "insights";

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

function getSocialReserveLabel(framework: FinanceTaxFramework): string {
  return framework === "italy" ? "INPS reserve" : "Self-employment reserve";
}

function getFixedSocialReserveLabel(framework: FinanceTaxFramework): string {
  return framework === "italy" ? "Fixed INPS" : "Fixed social reserve";
}

function getVariableSocialReserveLabel(framework: FinanceTaxFramework): string {
  return framework === "italy" ? "Variable INPS" : "Self-employment contributions";
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
    studio_fee_base_currency: "",
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

function getRelativeBarWidth(value: number, maxValue: number, minPercent = 10): string {
  if (value <= 0 || maxValue <= 0) return "0%";
  return `${Math.max(minPercent, (value / maxValue) * 100)}%`;
}

function getApproxRateSourceLabel(source: "live" | "fallback" | "mixed"): string {
  switch (source) {
    case "live":
      return "Frozen payment snapshots from live rates";
    case "fallback":
      return "Frozen payment snapshots from fallback rates";
    case "mixed":
      return "Mixed historical snapshots and fallback rates";
  }
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

function FinanceFormSection({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/60 p-4 shadow-sm sm:p-5 ${className}`.trim()}
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold tracking-[-0.01em] text-ink-900">{title}</h3>
        {description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

type MoneyFlowSegment = {
  label: string;
  value: number;
  color: string;
};

function MoneyFlowBar({
  title,
  total,
  currency,
  segments,
  note,
}: {
  title: string;
  total: number;
  currency: FinanceCurrency;
  segments: MoneyFlowSegment[];
  note?: string;
}) {
  const visibleSegments = segments.filter((segment) => segment.value > 0);

  return (
    <div className="rounded-2xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">{title}</p>
        <span className="text-sm font-medium text-foreground">{formatMoney(total, currency)}</span>
      </div>

      {visibleSegments.length > 0 ? (
        <>
          <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-[var(--sabbia-100)]">
            {visibleSegments.map((segment) => (
              <div
                key={segment.label}
                className="h-full"
                style={{
                  backgroundColor: segment.color,
                  flexGrow: segment.value,
                  flexBasis: 0,
                }}
              />
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleSegments.map((segment) => (
              <div
                key={segment.label}
                className="rounded-xl bg-[var(--sabbia-50)]/80 px-3 py-2 text-xs text-foreground-muted"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    {segment.label}
                  </span>
                  <span>{formatPercent(total > 0 ? (segment.value / total) * 100 : 0)}</span>
                </div>
                <p className="mt-1 font-medium text-foreground">
                  {formatMoney(segment.value, currency)}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-foreground-muted">No money flow to visualize for this month yet.</p>
      )}

      {note ? <p className="mt-3 text-xs text-foreground-muted">{note}</p> : null}
    </div>
  );
}

export default function AdminFinancePage() {
  const router = useRouter();
  const [month, setMonth] = useState(DEFAULT_MONTH);
  const [financeView, setFinanceView] = useState<FinanceWorkspaceView>("operations");
  const [dashboard, setDashboard] = useState<FinanceDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditingFinanceEntry | null>(null);
  const [sessionTotalAmount, setSessionTotalAmount] = useState("");
  const [showStudioSplitOverride, setShowStudioSplitOverride] = useState(false);
  const financeEntryAnchorRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (!showForm) return;
    setForm((current) => {
      const nextDate = `${month}-01`;
      if (current.payment_date.startsWith(month)) {
        return current;
      }

      return {
        ...current,
        payment_date: nextDate,
      };
    });
  }, [month, showForm]);

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
  const hasCustomSplitAmount = form.studio_fee_base_amount.trim().length > 0;

  const taxSummary = summary?.tax_summary ?? null;
  const fixedCostSummary = summary?.fixed_costs ?? null;
  const keepSummary = summary?.keep_summary ?? null;
  const variableExpenseSummary = summary?.variable_expenses ?? null;
  const italySimulation = taxSummary?.simulations.italy ?? null;
  const swedenSimulation = taxSummary?.simulations.sweden ?? null;

  useEffect(() => {
    setSessionTotalAmount("");
  }, [form.booking_id]);

  useEffect(() => {
    if (!showForm || financeView !== "operations") return;
    financeEntryAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [financeView, showForm]);

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

  const monthlyPulseMaxTotal = useMemo(() => {
    const points = summary?.monthly_trend ?? [];
    return points.reduce(
      (max, point) =>
        Math.max(max, point.net_total + point.studio_fee_total + point.processor_fee_total),
      0
    );
  }, [summary?.monthly_trend]);

  const invoiceReminderTrendMax = useMemo(() => {
    const points = summary?.monthly_trend ?? [];
    return points.reduce((max, point) => Math.max(max, point.open_invoice_count), 0);
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
    setEditingEntry(null);
    setSessionTotalAmount("");
    setShowStudioSplitOverride(false);
  }

  function resetExpenseForm(nextDashboard = dashboard, nextMonth = month) {
    setExpenseForm({
      id: undefined,
      expense_date: `${nextMonth}-01`,
      label: "",
      category: "supplies",
      amount: "",
      currency: nextDashboard?.settings.reporting_currency_primary ?? "EUR",
      notes: "",
    });
  }

  const financeViewDescription =
    financeView === "operations"
      ? "Daily-use workspace for entries, payouts, cashflow, and invoice reminders."
      : "Trend and planning workspace for charts, tax models, and historical comparisons.";
  const financeEntryButtonLabel =
    financeView !== "operations" && showForm
      ? "Back to form"
      : showForm
        ? "Hide form"
        : "Add finance entry";

  const financeFormHeading = editingEntry ? "Edit finance entry" : "Quick finance entry";
  const financeFormDescription = editingEntry
    ? "Adjust the existing project/payment details without re-entering the whole month by hand."
    : "Keep the required fields brutally short, then let Lia override the defaults only when reality demands it.";

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
        if (next.studio_fee_base_amount) {
          next.studio_fee_base_currency = defaultCurrency;
        }
        next.fee_percentage = String(
          getContextFeeDefault(workContext, dashboard.context_settings)
        );
      }

      if (key === "payment_method" && dashboard) {
        const method = value as FinancePaymentMethod;
        const needsInvoice = method === "card" && dashboard.settings.card_invoice_default;
        const actualFramework = dashboard.settings.active_tax_framework ?? "italy";
        next.invoice_needed = needsInvoice;
        next.processor_fee_percentage =
          method === "card"
            ? String(
                dashboard.settings.card_processor_fee_percentage ??
                  DEFAULT_CARD_PROCESSOR_FEE_PERCENTAGE
              )
            : "0";

        if (method === "card") {
          next.currency = actualFramework === "italy" ? "EUR" : next.reporting_currency;
        }
      }

      if (key === "studio_fee_base_amount") {
        const hasCustomSplitAmount = typeof value === "string" && value.trim().length > 0;
        if (!hasCustomSplitAmount) {
          next.studio_fee_base_currency = "";
        } else if (!next.studio_fee_base_currency) {
          next.studio_fee_base_currency = next.reporting_currency;
        }
      }

      return next;
    });
  }

  function startEditingEntry(project: FinanceProjectWithPayments, paymentId: string) {
    const payment = project.payments.find((item) => item.id === paymentId);
    if (!payment || !dashboard) return;

    setFinanceView("operations");
    setShowForm(true);
    setEditingEntry({ projectId: project.id, paymentId: payment.id });
    setSessionTotalAmount("");
    setShowStudioSplitOverride(payment.studio_fee_base_amount !== null);
    setForm({
      booking_id: project.booking_id ?? "",
      client_name: project.client_name,
      project_label: project.project_label,
      session_date: project.session_date ?? "",
      work_context: project.work_context,
      payment_label: payment.payment_label,
      payment_date: payment.payment_date,
      gross_amount: String(payment.gross_amount),
      currency: payment.currency,
      reporting_currency: payment.reporting_currency,
      payment_method: payment.payment_method,
      fee_percentage: String(payment.fee_percentage),
      studio_fee_base_amount:
        payment.studio_fee_base_amount !== null ? String(payment.studio_fee_base_amount) : "",
      studio_fee_base_currency: payment.studio_fee_base_currency ?? "",
      processor_fee_percentage: String(payment.processor_fee_percentage),
      invoice_needed: payment.invoice_needed,
      invoice_done: payment.invoice_done,
      invoice_reference: payment.invoice_reference ?? "",
      project_notes: project.notes ?? "",
      payment_notes: payment.notes ?? "",
    });
  }

  function startEditingExpense(expense: typeof monthlyVariableExpenses[number]) {
    setShowExpenseForm(true);
    setExpenseForm({
      id: expense.id,
      expense_date: expense.expense_date,
      label: expense.label,
      category: expense.category,
      amount: String(expense.amount),
      currency: expense.currency,
      notes: expense.notes ?? "",
    });
  }

  async function handleCreateEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const isEditing = editingEntry !== null;
      const response = await fetch("/api/admin/finance", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEditing
            ? {
                id: editingEntry?.paymentId,
                project_id: editingEntry?.projectId,
              }
            : {}),
          ...form,
          booking_id: form.booking_id || null,
          client_name: form.client_name || null,
          project_label: form.project_label || null,
          gross_amount: Number(form.gross_amount),
          fee_percentage: Number(form.fee_percentage),
          studio_fee_base_amount:
            form.studio_fee_base_amount.trim().length > 0
              ? Number(form.studio_fee_base_amount)
              : null,
          studio_fee_base_currency:
            form.studio_fee_base_amount.trim().length > 0 && form.studio_fee_base_currency
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
        throw new Error(data.error || `Failed to ${isEditing ? "update" : "create"} finance entry`);
      }

      const nextDashboard = data as FinanceDashboardResponse;
      setDashboard(nextDashboard);
      setMonth(nextDashboard.month);
      setShowForm(false);
      resetForm(nextDashboard.month, nextDashboard);
      setSuccess(isEditing ? "Finance entry updated." : "Finance entry saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save finance entry");
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
      const isEditing = Boolean(expenseForm.id);
      const response = await fetch("/api/admin/finance", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEditing
            ? {
                id: expenseForm.id,
                action: "update",
              }
            : {}),
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
        throw new Error(data.error || `Failed to ${isEditing ? "update" : "create"} expense`);
      }

      setDashboard(data as FinanceDashboardResponse);
      setShowExpenseForm(false);
      resetExpenseForm(data as FinanceDashboardResponse, month);
      setSuccess(isEditing ? "Expense updated." : "Expense added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry(projectId: string, paymentId: string) {
    if (!confirm("Delete this finance entry? This removes the payment and deletes the project too if it has no other payments.")) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/finance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: paymentId,
          project_id: projectId,
          action: "delete",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete finance entry");
      }

      setDashboard(data as FinanceDashboardResponse);
      if (editingEntry?.paymentId === paymentId) {
        resetForm((data as FinanceDashboardResponse).month, data as FinanceDashboardResponse);
        setShowForm(false);
      }
      setSuccess("Finance entry removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete finance entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm("Delete this expense?")) {
      return;
    }

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
      if (expenseForm.id === id) {
        resetExpenseForm(data as FinanceDashboardResponse, (data as FinanceDashboardResponse).month);
        setShowExpenseForm(false);
      }
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

    const takeHome = summary.net_totals_by_reporting_currency[currency];
    const studioFees = summary.studio_fee_totals_by_reporting_currency[currency];
    const cardFees = summary.processor_fee_approx_totals_by_reporting_currency[currency];
    const bucketTotal = takeHome + studioFees + cardFees;
    const bucketSegments = [
      {
        label: "Studio fees",
        value: studioFees,
        color: "var(--trad-red-500)",
      },
      {
        label: "Card fee drag",
        value: cardFees,
        color: "var(--blush-300)",
      },
      {
        label: "Cash kept",
        value: takeHome,
        color: "var(--ink-900)",
      },
    ].filter((segment) => segment.value > 0);

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
          {bucketSegments.length > 0 ? (
            <div className="space-y-3">
              <div className="flex h-3 overflow-hidden rounded-full bg-white/80">
                {bucketSegments.map((segment) => (
                  <div
                    key={segment.label}
                    className="h-full"
                    style={{
                      backgroundColor: segment.color,
                      flexGrow: segment.value,
                      flexBasis: 0,
                    }}
                  />
                ))}
              </div>
              <div className="grid gap-2 text-xs text-foreground-muted">
                {bucketSegments.map((segment) => (
                  <div key={segment.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: segment.color }}
                      />
                      {segment.label}
                    </span>
                    <span>
                      {formatMoney(segment.value, currency)}
                      {bucketTotal > 0 ? ` · ${formatPercent((segment.value / bucketTotal) * 100)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-foreground-muted">Cash kept</span>
            <span className="font-medium text-foreground">
              {formatMoney(takeHome, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-foreground-muted">Studio fees</span>
            <span className="text-foreground">
              {formatMoney(studioFees, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-foreground-muted">Card fee drag</span>
            <span className="text-foreground">
              {formatMoney(cardFees, currency)}
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
      description="Track monthly cash kept, studio splits, card fees, and invoice reminders without turning Lia’s admin into fake accounting theater."
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
              setSuccess("");
              if (financeView !== "operations") {
                setFinanceView("operations");
                if (!showForm) {
                  setShowForm(true);
                }
                return;
              }
              setShowForm((current) => {
                const next = !current;
                if (!next) {
                  resetForm();
                }
                return next;
              });
            }}
          >
            {financeEntryButtonLabel}
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

      <div className="mb-6 rounded-2xl border border-[var(--sabbia-200)] bg-white/90 p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFinanceView("operations")}
            className={`inline-flex min-h-[40px] items-center rounded-xl px-4 py-2 text-sm transition-colors ${
              financeView === "operations"
                ? "bg-[var(--ink-900)] text-[var(--sabbia-50)]"
                : "bg-[var(--sabbia-100)] text-foreground hover:bg-[var(--sabbia-200)]"
            }`}
          >
            Operations
          </button>
          <button
            type="button"
            onClick={() => setFinanceView("insights")}
            className={`inline-flex min-h-[40px] items-center rounded-xl px-4 py-2 text-sm transition-colors ${
              financeView === "insights"
                ? "bg-[var(--ink-900)] text-[var(--sabbia-50)]"
                : "bg-[var(--sabbia-100)] text-foreground hover:bg-[var(--sabbia-200)]"
            }`}
          >
            Insights
          </button>
          <div className="flex min-h-[40px] items-center px-1 text-sm text-foreground-muted">
            {financeViewDescription}
          </div>
        </div>
      </div>

      {financeView === "operations" ? (
        <div className="mb-6 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                  : summary.weekly.at(-1)?.label ?? "No payments this week"
              }
            />
            <AdminMetricCard
              label="Cash received"
              tone="success"
              value={
                loading || !keepSummary
                  ? "..."
                  : formatMoney(keepSummary.active_cashflow.cash_received, keepSummary.currency)
              }
              detail={
                loading || !keepSummary
                  ? ""
                  : `${keepSummary.payment_count} payment${keepSummary.payment_count === 1 ? "" : "s"} after studio split + card fees`
              }
            />
            <AdminMetricCard
              label="Payment fees"
              value={
                loading || !keepSummary
                  ? "..."
                  : formatMoney(keepSummary.active_cashflow.processor_fees, keepSummary.currency)
              }
              detail="Only payment methods that actually use a processor."
            />
            <AdminMetricCard
              label="Disposable estimate"
              value={
                loading || !keepSummary
                  ? "..."
                  : formatMoney(keepSummary.active_cashflow.estimated_disposable, keepSummary.currency)
              }
              detail={
                loading || !keepSummary
                  ? ""
                  : `${formatMonthLabel(month)} after reserve + business costs`
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              label="Studio fees"
              tone="accent"
              value={
                loading || !summary
                  ? "..."
                  : `${formatMoney(summary.studio_fee_totals_by_reporting_currency.SEK, "SEK")} · ${formatMoney(summary.studio_fee_totals_by_reporting_currency.DKK, "DKK")} · ${formatMoney(summary.studio_fee_totals_by_reporting_currency.EUR, "EUR")}`
              }
              valueClassName="text-lg leading-tight sm:text-xl"
              detail="Local payout buckets by studio/context."
            />
            <AdminMetricCard
              label="SumUp fees"
              value={
                loading || !summary
                  ? "..."
                  : formatMoney(summary.processor_fee_totals_by_processor_currency.EUR, "EUR")
              }
              detail="Raw processor fees stay in EUR."
            />
            <AdminMetricCard
              label="Invoice reminders"
              value={
                loading || !summary
                  ? "..."
                  : `${summary.open_invoice_count} pending`
              }
              tone={(summary?.open_invoice_count ?? 0) > 0 ? "warning" : "success"}
              detail={
                loading || !keepSummary || !summary
                  ? ""
                  : `${keepSummary.invoiced_payment_count} inside reserve · ${keepSummary.excluded_payment_count} outside invoice-based reserve`
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
                  : `Normalized overview only · ${getApproxRateSourceLabel(summary.approx_secondary.source)}`
              }
            />
          </div>
        </div>
      ) : null}

      <div className="mb-6">
        <AdminSurface>
          <AdminSectionHeading
            title={
              financeView === "operations"
                ? "Cashflow and Disposable Money"
                : "Cashflow Planning Snapshot"
            }
            description={
              financeView === "operations"
                ? "Use all monthly cash received as the real base. Then reserve income tax only on invoiced payments, add mandatory social/fixed obligations, and subtract materials so Lia can see what is truly disposable."
                : "Keep the finance logic visible while exploring trends and comparisons, without dragging the whole operational workspace along."
            }
          />

          {loading || !summary || !keepSummary ? (
            <p className="text-sm text-foreground-muted">Loading cashflow summary...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                        Current month disposable estimate
                      </p>
                      <div className="mt-2 text-xl font-medium text-foreground sm:text-2xl">
                        {formatMoney(keepSummary.active_cashflow.estimated_disposable, keepSummary.currency)}
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-foreground-muted shadow-sm">
                      {FINANCE_TAX_FRAMEWORK_LABELS[keepSummary.active_cashflow.framework]} reserve view
                    </span>
                  </div>

                  <div className="mt-3 grid gap-x-4 gap-y-2 text-xs text-foreground-muted sm:grid-cols-2 xl:grid-cols-3">
                    <div className="flex items-center justify-between gap-3">
                      <span>Gross charged</span>
                      <span>{formatMoney(keepSummary.active_cashflow.gross_charged, keepSummary.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Studio split</span>
                      <span>{formatMoney(keepSummary.active_cashflow.studio_fees, keepSummary.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Payment fees</span>
                      <span>{formatMoney(keepSummary.active_cashflow.processor_fees, keepSummary.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Cash received</span>
                      <span>{formatMoney(keepSummary.active_cashflow.cash_received, keepSummary.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Income tax reserve</span>
                      <span>{formatMoney(keepSummary.active_cashflow.income_tax_reserve, keepSummary.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{getSocialReserveLabel(keepSummary.active_cashflow.framework)}</span>
                      <span>{formatMoney(keepSummary.active_cashflow.social_reserve, keepSummary.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Fixed obligations</span>
                      <span>{formatMoney(keepSummary.active_cashflow.fixed_obligation_reserve, keepSummary.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Variable costs</span>
                      <span>{formatMoney(keepSummary.active_cashflow.variable_expense_reserve, keepSummary.currency)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                    Reserve basis
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-foreground-muted">
                    <div className="flex items-center justify-between gap-3">
                      <span>Payments inside reserve</span>
                      <span>{keepSummary.invoiced_payment_count}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Outside invoice-based reserve</span>
                      <span>{keepSummary.excluded_payment_count}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Gross outside reserve</span>
                      <span>{formatMoney(keepSummary.excluded_gross_total, keepSummary.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Income tax sees</span>
                      <span>{formatMoney(keepSummary.active_cashflow.invoiced_gross, keepSummary.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{getFixedSocialReserveLabel(keepSummary.active_cashflow.framework)}</span>
                      <span>{formatMoney(keepSummary.active_cashflow.fixed_social_reserve, keepSummary.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{getVariableSocialReserveLabel(keepSummary.active_cashflow.framework)}</span>
                      <span>{formatMoney(keepSummary.active_cashflow.variable_social_reserve, keepSummary.currency)}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-foreground-muted">
                    Cash can already be received even when the reserve basis is not complete yet. Only payments marked as invoice done enter the percentage-based income-tax reserve; fixed social obligations and other business costs still reduce what is truly disposable.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <MoneyFlowBar
                  title="Where cash leaves the payment"
                  total={keepSummary.active_cashflow.gross_charged}
                  currency={keepSummary.currency}
                  segments={[
                    {
                      label: "Studio split",
                      value: keepSummary.active_cashflow.studio_fees,
                      color: "var(--trad-red-500)",
                    },
                    {
                      label: "Payment fees",
                      value: keepSummary.active_cashflow.processor_fees,
                      color: "var(--blush-300)",
                    },
                    {
                      label: "Cash received",
                      value: keepSummary.active_cashflow.cash_received,
                      color: "var(--ink-900)",
                    },
                  ]}
                  note="This split uses all monthly payments. Studio share and processor drag leave first; the rest is the actual cash pool Lia has in hand."
                />

                <MoneyFlowBar
                  title="Where cash stops being disposable"
                  total={keepSummary.active_cashflow.cash_received}
                  currency={keepSummary.currency}
                  segments={[
                    {
                      label: "Income tax reserve",
                      value: keepSummary.active_cashflow.income_tax_reserve,
                      color: "var(--trad-red-500)",
                    },
                    {
                      label: getSocialReserveLabel(keepSummary.active_cashflow.framework),
                      value: keepSummary.active_cashflow.social_reserve,
                      color: "var(--ink-700)",
                    },
                    {
                      label: "Fixed obligations",
                      value: keepSummary.active_cashflow.fixed_obligation_reserve,
                      color: "var(--sabbia-400)",
                    },
                    {
                      label: "Variable costs",
                      value: keepSummary.active_cashflow.variable_expense_reserve,
                      color: "var(--blush-300)",
                    },
                    {
                      label: "Still disposable",
                      value: Math.max(0, keepSummary.active_cashflow.estimated_disposable),
                      color: "var(--accent)",
                    },
                  ]}
                  note="Income tax still only sees invoiced work. Fixed social and business obligations still reduce what is safe to treat as disposable."
                />
              </div>

              {financeView === "insights" ? (
                <details className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/60 p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Model comparison</p>
                      <p className="mt-1 text-xs text-foreground-muted">
                        Keep this collapsed unless you actually need to compare Italy startup, Italy standard, and Sweden side by side.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-foreground-muted shadow-sm">
                      3 scenarios
                    </span>
                  </div>
                </summary>

                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  {Object.values(keepSummary.scenarios).map((scenario) => (
                    <div
                      key={scenario.key}
                      className={`rounded-2xl border p-4 ${scenario.active ? "border-[var(--ink-900)] bg-white shadow-sm" : "border-[var(--sabbia-200)] bg-white/80"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                            {scenario.active ? "Active model" : "Projection"}
                          </p>
                          <p className="mt-2 font-medium text-foreground">{scenario.label}</p>
                          <p className="mt-1 text-xs text-foreground-muted">Shown in {scenario.currency}</p>
                        </div>
                        <span className="rounded-full bg-[var(--sabbia-50)] px-2.5 py-1 text-[11px] text-foreground-muted">
                          {FINANCE_TAX_FRAMEWORK_LABELS[scenario.framework]}
                        </span>
                      </div>

                      <div className="mt-3 text-xl font-medium text-foreground sm:text-2xl">
                        {formatMoney(scenario.estimated_disposable, scenario.currency)}
                      </div>

                      <div className="mt-3 grid gap-x-4 gap-y-2 text-xs text-foreground-muted sm:grid-cols-2">
                        <div className="flex items-center justify-between gap-3">
                          <span>Cash received</span>
                          <span>{formatMoney(scenario.cash_received, scenario.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Income tax reserve</span>
                          <span>{formatMoney(scenario.income_tax_reserve, scenario.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>{getSocialReserveLabel(scenario.framework)}</span>
                          <span>{formatMoney(scenario.social_reserve, scenario.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Fixed obligations</span>
                          <span>{formatMoney(scenario.fixed_obligation_reserve, scenario.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Variable costs</span>
                          <span>{formatMoney(scenario.variable_expense_reserve, scenario.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Reserve basis</span>
                          <span>{formatMoney(scenario.invoiced_gross, scenario.currency)}</span>
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-foreground-muted">
                        {scenario.missing_fixed_cost_count > 0
                          ? `${scenario.missing_fixed_cost_count} fixed cost amount${scenario.missing_fixed_cost_count === 1 ? " is" : "s are"} still missing`
                          : "All active fixed-cost rows in this model have amounts."}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
              ) : null}

            </div>
          )}
        </AdminSurface>
      </div>

      {financeView === "operations" ? (
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
              <div className="grid gap-4 xl:grid-cols-2">
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

              {fixedCostSummary.missing_amount_count > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {fixedCostSummary.missing_amount_count} fixed cost amount{fixedCostSummary.missing_amount_count === 1 ? " is" : "s are"} still missing, so they are excluded from totals for now.
                </div>
              ) : null}

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
      ) : null}

      {financeView === "operations" ? (
      <div className="mb-6">
        <AdminSurface>
          <AdminSectionHeading
            title="Variable business expenses"
            description="Track flexible work costs like needles, ink, supplies, and travel by month. They reduce the keep estimate without forcing Lia into item-by-item accounting hell."
            action={
              <AdminButton
                variant={showExpenseForm ? "ghost" : "secondary"}
                onClick={() => {
                  setShowExpenseForm((current) => {
                    const next = !current;
                    if (next) {
                      resetExpenseForm();
                    }
                    return next;
                  });
                }}
              >
                {showExpenseForm
                  ? expenseForm.id
                    ? "Hide expense editor"
                    : "Hide expense form"
                  : "Add expense"}
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
                  {saving
                    ? "Saving..."
                    : expenseForm.id
                      ? "Save expense changes"
                      : "Save expense"}
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
                        <div className="mt-2 flex flex-wrap justify-end gap-2">
                          <AdminButton
                            variant="secondary"
                            className="!min-h-[32px] !px-3 !py-1 text-xs"
                            disabled={saving}
                            onClick={() => startEditingExpense(expense)}
                          >
                            Edit
                          </AdminButton>
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
      ) : null}

      {financeView === "operations" ? (
      <div ref={financeEntryAnchorRef} />
      ) : null}

      {financeView === "operations" && showForm ? (
        <AdminSurface className="mb-6">
          <AdminSectionHeading
            title={financeFormHeading}
            description={financeFormDescription}
          />

          <form className="grid gap-5" onSubmit={handleCreateEntry}>
            <FinanceFormSection
              title="Session setup"
              description="Who, where, and when this payment belongs to."
            >
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
            </FinanceFormSection>

            <FinanceFormSection
              title="Money flow"
              description="Start from what the client actually paid, then override the studio split only when reality is weirder than the default."
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-foreground-muted">
                    {form.payment_method === "card" ? "Client charged amount" : "Payment amount received"}
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
                    {form.payment_method === "card" ? (
                      <span className="mt-1 block text-xs text-foreground-muted">
                        Enter the real amount charged to the client here. Card fees stay tied to this amount.
                      </span>
                    ) : null}
                    {selectedBookingDeposit > 0 ? (
                      <span className="mt-1 block text-xs text-foreground-muted">
                        Enter the actual amount paid in this transaction. If the booking had a non-invoiced deposit, this should usually be the remainder, not the full tattoo price.
                      </span>
                    ) : null}
                  </label>

                  <label className="text-sm text-foreground-muted">
                    Client payment currency
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

                  <label className="text-sm text-foreground-muted md:col-span-2">
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

                <div className="space-y-4">
                  <div className="rounded-3xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Studio split</p>
                        <p className="mt-1 text-xs text-foreground-muted">
                          Default: use the same amount as the client payment.
                          {form.payment_method === "card"
                            ? " Turn this on only when Lia pays the studio from a different local amount."
                            : " Turn this on only when the studio percentage should be based on another amount."}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 rounded-full bg-[var(--sabbia-50)] px-3 py-1.5 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={showStudioSplitOverride}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setShowStudioSplitOverride(checked);
                            if (!checked) {
                              updateForm("studio_fee_base_amount", "");
                              return;
                            }

                            if (!form.studio_fee_base_currency) {
                              updateForm("studio_fee_base_currency", form.reporting_currency);
                            }
                          }}
                        />
                        Use custom split amount
                      </label>
                    </div>

                    {showStudioSplitOverride ? (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="text-sm text-foreground-muted">
                          Studio split amount
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.studio_fee_base_amount}
                            onChange={(event) =>
                              updateForm("studio_fee_base_amount", event.target.value)
                            }
                            placeholder="Example: 2000"
                            className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                            style={{ fontSize: "16px" }}
                          />
                          <span className="mt-1 block text-xs text-foreground-muted">
                            This is the amount the studio percentage should use, not the fee itself.
                          </span>
                        </label>

                        <label className="text-sm text-foreground-muted">
                          Studio split currency
                          <select
                            value={form.studio_fee_base_currency}
                            onChange={(event) =>
                              updateForm("studio_fee_base_currency", event.target.value as FinanceCurrency)
                            }
                            className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                            style={{ fontSize: "16px" }}
                          >
                            <option value="">Select currency</option>
                            {FINANCE_CURRENCY_OPTIONS.map((currency) => (
                              <option key={currency} value={currency}>
                                {currency}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl bg-[var(--sabbia-50)]/80 px-4 py-3 text-sm text-foreground-muted">
                        Studio split will follow the same amount and currency as the client payment.
                      </div>
                    )}

                    {form.payment_method === "card" ? (
                      <p className="mt-3 text-xs text-foreground-muted">
                        Example: client pays `185 EUR` by card, but the Swedish studio split should be calculated from `2000 SEK`.
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-3xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm">
                    <p className="text-sm font-medium text-foreground">Current defaults</p>
                    <p className="mt-2 text-sm text-foreground-muted">
                      {dashboard ? getContextLabel(form.work_context, dashboard.context_settings) : form.work_context}{" "}
                      reports in {form.reporting_currency} and uses {form.fee_percentage}% studio fee.
                    </p>
                    <p className="mt-2 text-sm text-foreground-muted">
                      {form.payment_method === "card"
                        ? `Card fee currently deducts ${form.processor_fee_percentage}% and invoice reminder is ${form.invoice_needed ? "on" : "off"}.`
                        : "Non-card payments default to 0% processor fee."}
                    </p>
                    <p className="mt-2 text-sm text-foreground-muted">
                      {hasCustomSplitAmount
                        ? `Studio split currently uses ${form.studio_fee_base_amount} ${form.studio_fee_base_currency || form.reporting_currency}.`
                        : "Studio split currently follows the client payment amount."}
                    </p>
                  </div>
                </div>
              </div>

              {selectedBookingDeposit > 0 ? (
                <div className="mt-4 rounded-2xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm">
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
            </FinanceFormSection>

            <FinanceFormSection
              title="Project details"
              description="Optional metadata for finding the payment later without turning the form into a tax return."
            >
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

              <div className="mt-4 grid gap-4 md:grid-cols-2">
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
            </FinanceFormSection>

            <FinanceFormSection
              title="Invoice tracking"
              description="Only the admin bits needed to remember whether this payment still needs invoicing."
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
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

                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-white px-4 py-4 text-sm text-foreground-muted shadow-sm">
                  <p className="font-medium text-foreground">Invoice status</p>
                  <div className="mt-3 flex flex-col gap-3">
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
                        onChange={(event) => {
                          const checked = event.target.checked;
                          if (checked) {
                            updateForm("invoice_needed", true);
                          }
                          updateForm("invoice_done", checked);
                        }}
                      />
                      Invoice done
                    </label>
                  </div>

                  {selectedBooking?.deposit_amount ? (
                    <p className="mt-4 text-xs leading-relaxed text-foreground-muted">
                      Linked booking deposit: {selectedBooking.deposit_amount}{" "}
                      {selectedBooking.location === "copenhagen" ? "DKK" : "SEK"}. Best practice: enter only the remainder here if the PayPal deposit stays non-invoiced.
                    </p>
                  ) : null}
                </div>
              </div>
            </FinanceFormSection>

            <div className="flex flex-wrap gap-2">
              <AdminButton variant="primary" type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingEntry
                    ? "Save finance changes"
                    : "Save finance entry"}
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

      {financeView === "operations" ? (
      <div className="mb-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <CollapsibleFinanceSection
          title="Reporting buckets"
          description="Top cards show the overview. These buckets keep Malmö in SEK, Copenhagen in DKK, and only use conversion when you explicitly ask for an approximate overview."
          defaultOpen
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
      ) : null}

      {financeView === "operations" ? (
        <div className="mb-6">
          <CollapsibleFinanceSection
            title="Payouts to studios"
            description="This is the operational bit Lia actually needs at month end: who gets paid, in which local currency, and the fee reserve attached to that bucket."
            defaultOpen
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
                        <span>Card fee drag</span>
                        <span>{formatMoney(row.processor_fee_total, row.reporting_currency)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">
                No studio payouts accumulated for {formatMonthLabel(month)} yet.
              </p>
            )}
          </CollapsibleFinanceSection>
        </div>
      ) : null}

      {financeView === "insights" ? (
      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <CollapsibleFinanceSection
          title={italySimulation?.label ?? "Italy tax model"}
          description="Yearly tax simulation for the selected year. Only payments marked `invoice_done = true` are included, so non-invoiced deposits stay out of this on purpose."
        >

          {loading || !summary || !taxSummary || !italySimulation ? (
            <p className="text-sm text-foreground-muted">Loading tax simulation...</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                      Estimated yearly net after Italy model
                    </p>
                    <div className="mt-2 text-xl font-medium text-foreground sm:text-2xl">
                      {formatMoney(italySimulation.net_income, italySimulation.currency)}
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-foreground-muted shadow-sm">
                    Effective rate {formatPercent(italySimulation.effective_tax_rate)}
                  </span>
                </div>

                <div className="mt-3 grid gap-x-4 gap-y-2 text-xs text-foreground-muted sm:grid-cols-2 xl:grid-cols-3">
                  <div className="flex items-center justify-between gap-3">
                    <span>Revenue</span>
                    <span>{formatMoney(italySimulation.invoiced_revenue, italySimulation.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Taxable profit</span>
                    <span>{formatMoney(italySimulation.taxable_profit, italySimulation.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Fixed INPS</span>
                    <span>{formatMoney(italySimulation.fixed_social_contributions, italySimulation.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Variable INPS</span>
                    <span>{formatMoney(italySimulation.variable_social_contributions, italySimulation.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Income tax</span>
                    <span>{formatMoney(italySimulation.income_tax, italySimulation.currency)}</span>
                  </div>
                </div>
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
                    Deposit-free, invoiced-only yearly base.
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

        <CollapsibleFinanceSection
          title="Last 6 months"
          description="Cash-kept trend in the primary reporting currency, so the direction of travel is obvious at a glance."
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
                Dark bars show cash kept. Week and card-fee details stay separate below so the chart doesn’t turn into a spaghetti monster.
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">
              Trend data will appear once there are payments across multiple months.
            </p>
          )}
        </CollapsibleFinanceSection>
      </div>
      ) : null}

      {financeView === "insights" ? (
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
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                        Estimated yearly net after Sweden model
                      </p>
                      <div className="mt-2 text-xl font-medium text-foreground sm:text-2xl">
                        {formatMoney(swedenSimulation.net_income, swedenSimulation.currency)}
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-foreground-muted shadow-sm">
                      Effective rate {formatPercent(swedenSimulation.effective_tax_rate)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-x-4 gap-y-2 text-xs text-foreground-muted sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3">
                      <span>Revenue</span>
                      <span>{formatMoney(swedenSimulation.invoiced_revenue, swedenSimulation.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Self-employment contributions</span>
                      <span>{formatMoney(swedenSimulation.variable_social_contributions, swedenSimulation.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:col-span-2">
                      <span>Income tax</span>
                      <span>{formatMoney(swedenSimulation.income_tax, swedenSimulation.currency)}</span>
                    </div>
                  </div>
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
                    Invoiced-only comparison model
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
      ) : null}

      {financeView === "insights" ? (
      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <CollapsibleFinanceSection
          title="Monthly finance pulse"
          description="Seasonality in one place: cash kept, studio drag, card fee drag, and pending invoice reminders across the last six months."
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
                        {point.open_invoice_count} pending reminder{point.open_invoice_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {formatMoney(point.net_total, summary.approx_primary.currency)}
                    </p>
                  </div>
                  <div className="mt-3 rounded-full bg-white/80 p-1">
                    <div
                      className="flex h-4 overflow-hidden rounded-full"
                      style={{
                        width: getRelativeBarWidth(
                          point.net_total + point.studio_fee_total + point.processor_fee_total,
                          monthlyPulseMaxTotal,
                          12
                        ),
                      }}
                    >
                      {point.net_total > 0 ? (
                        <div
                          className="h-full"
                          style={{
                            width: `${((point.net_total / (point.net_total + point.studio_fee_total + point.processor_fee_total)) * 100).toFixed(2)}%`,
                            backgroundColor: "var(--ink-900)",
                          }}
                        />
                      ) : null}
                      {point.studio_fee_total > 0 ? (
                        <div
                          className="h-full"
                          style={{
                            width: `${((point.studio_fee_total / (point.net_total + point.studio_fee_total + point.processor_fee_total)) * 100).toFixed(2)}%`,
                            backgroundColor: "var(--trad-red-500)",
                          }}
                        />
                      ) : null}
                      {point.processor_fee_total > 0 ? (
                        <div
                          className="h-full"
                          style={{
                            width: `${((point.processor_fee_total / (point.net_total + point.studio_fee_total + point.processor_fee_total)) * 100).toFixed(2)}%`,
                            backgroundColor: "var(--blush-300)",
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-foreground-muted sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-white px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="block h-2.5 w-2.5 rounded-full bg-[var(--ink-900)]" />
                        Cash kept
                      </span>
                      <p className="mt-1 font-medium text-foreground">
                        {formatMoney(point.net_total, summary.approx_primary.currency)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="block h-2.5 w-2.5 rounded-full bg-[var(--trad-red-500)]" />
                        Studio fees
                      </span>
                      <p className="mt-1 font-medium text-foreground">
                        {formatMoney(point.studio_fee_total, summary.approx_primary.currency)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="block h-2.5 w-2.5 rounded-full bg-[var(--blush-300)]" />
                        SumUp drag
                      </span>
                      <p className="mt-1 font-medium text-foreground">
                        {formatMoney(point.processor_fee_total, summary.approx_primary.currency)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="block h-2.5 w-2.5 rounded-full bg-amber-400" />
                        Pending reminders
                      </span>
                      <p className="mt-1 font-medium text-foreground">{point.open_invoice_count}</p>
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
          title="Invoice reminder trend"
          description="Simple period-over-period read on pending invoice reminders so Lia can see if admin debt is shrinking or breeding."
        >

          {loading || !summary || !latestTrendPoint ? (
            <p className="text-sm text-foreground-muted">Loading reminder trend...</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                  Current month reminders
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
                    className="rounded-xl bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-foreground">{point.label}</span>
                      <span className="text-sm text-foreground-muted">
                        {point.open_invoice_count} pending reminder{point.open_invoice_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-2 h-3 rounded-full bg-[var(--sabbia-100)]">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{
                          width: getRelativeBarWidth(
                            point.open_invoice_count,
                            invoiceReminderTrendMax,
                            14
                          ),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleFinanceSection>
      </div>
      ) : null}

      {financeView === "insights" ? (
      <div className="mb-6">
        <CollapsibleFinanceSection
          title="Payout history"
          description="A six-month view of what each studio or context reserve needed per month, with card fee drag attached to that bucket."
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
                    <th className="px-4 py-3 font-medium">Card fee drag</th>
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
                Payout history will start filling out after more months of data.
              </p>
          )}
        </CollapsibleFinanceSection>
      </div>
      ) : null}

      {financeView === "operations" ? (
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <CollapsibleFinanceSection
            title="Studio / context totals"
            description="Grouped by actual working context and native reporting bucket, so Malmö and Copenhagen stop bleeding into a fake currency view."
            defaultOpen
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
                    <th className="px-4 py-3 font-medium">Cash kept</th>
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
                              <div className="grid gap-1 text-right text-xs sm:min-w-56">
                                <p className="text-foreground-muted">
                                  Charged {formatMoney(payment.gross_amount, payment.currency)}
                                </p>
                                <p className="text-foreground-muted">
                                  Studio fee {formatMoney(payment.fee_amount, payment.reporting_currency)} in {payment.reporting_currency}
                                </p>
                                <p className="text-foreground-muted">
                                  Card fee {formatMoney(payment.processor_fee_amount, payment.processor_fee_currency)}
                                </p>
                                <p className="font-medium text-foreground">
                                  Cash kept {formatMoney(payment.original_net_amount, payment.currency)}
                                </p>
                                {payment.currency !== payment.reporting_currency ? (
                                  <p className="text-foreground-muted">
                                    Reporting view {formatMoney(payment.net_amount, payment.reporting_currency)}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                              <AdminButton
                                variant="secondary"
                                className="!min-h-[32px] !px-3 !py-1 text-xs"
                                disabled={saving}
                                onClick={() => startEditingEntry(project, payment.id)}
                              >
                                Edit
                              </AdminButton>
                              <AdminButton
                                variant="ghost"
                                className="!min-h-[32px] !px-3 !py-1 text-xs"
                                disabled={saving}
                                onClick={() => handleDeleteEntry(project.id, payment.id)}
                              >
                                Delete
                              </AdminButton>
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
                      <p>Charged {formatMoney(payment.gross_amount, payment.currency)}</p>
                      <p>Studio fee {formatMoney(payment.fee_amount, payment.reporting_currency)} in {payment.reporting_currency}</p>
                      <p>Card fee {formatMoney(payment.processor_fee_amount, payment.processor_fee_currency)}</p>
                      {payment.currency !== payment.reporting_currency ? (
                        <p>Reporting view {formatMoney(payment.net_amount, payment.reporting_currency)}</p>
                      ) : null}
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
                        Cash kept {formatMoney(payment.original_net_amount, payment.currency)}
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
                No pending invoice reminders for {formatMonthLabel(month)}.
              </p>
            )}
          </AdminSurface>
        </div>
      </div>
      ) : null}
    </AdminShell>
  );
}
