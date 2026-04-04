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
  AdminCheckboxCard,
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

type BulkEntryMode = "single" | "multiple";

type EditingFinanceEntry = {
  projectId: string;
  paymentId: string;
};

type FinanceWorkspaceView = "operations" | "insights";

const DEFAULT_MONTH = normalizeMonthKey();
const REPORTING_CURRENCIES: FinanceCurrency[] = ["SEK", "DKK", "EUR"];
const DAY_IN_MS = 86400000;
const DEFAULT_VISIBLE_PROJECTS = 4;

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
      return "Pay Diamant studio";
    case "copenhagen_studio":
      return "Pay Good Morning Tattoo studio";
    case "torino_studio":
      return "Pay Studio Etra";
    case "guest_spot":
      return "Touring fee reserve";
    case "private_home":
      return "Friuli fee reserve";
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

function buildFormStateFromExistingEntry(
  project: FinanceProjectWithPayments,
  payment: FinanceProjectWithPayments["payments"][number]
): FinanceFormState {
  return {
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
  };
}

function getReportingBucketGridClass(bucketCount: number): string {
  if (bucketCount <= 1) return "grid-cols-1";
  if (bucketCount === 2) return "grid-cols-1 lg:grid-cols-2";
  return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
}

function getNextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const nextMonth = new Date(year, month, 1);

  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
}

function formatShortMonthLabel(monthKey: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
  }).format(new Date(`${monthKey}-01T00:00:00`));
}

type FinanceTrendProjection = {
  month: string;
  net_total: number;
  based_on_months: number;
  delta_from_latest: number;
};

function getTrendProjection(
  points: FinanceMonthlyTrendPoint[]
): FinanceTrendProjection | null {
  if (points.length < 2) return null;

  const basisPoints = points.slice(-Math.min(points.length, 3));
  const latestPoint = basisPoints.at(-1);

  if (!latestPoint) return null;

  const projectedNet =
    basisPoints.reduce((sum, point) => sum + point.net_total, 0) / basisPoints.length;

  return {
    month: getNextMonthKey(latestPoint.month),
    net_total: projectedNet,
    based_on_months: basisPoints.length,
    delta_from_latest: projectedNet - latestPoint.net_total,
  };
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
  collapsedPreview,
}: {
  title: string;
  description: string;
  children: ReactNode;
  defaultOpen?: boolean;
  collapsedPreview?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details className="rounded-3xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm" open={isOpen}>
      <summary
        className="cursor-pointer list-none"
        onClick={(event) => {
          event.preventDefault();
          setIsOpen((current) => !current);
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 pr-0 sm:pr-6">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink-900">{title}</h2>
            <p className="mt-1 text-sm text-foreground-muted">{description}</p>
            {!isOpen && collapsedPreview ? <div className="mt-3">{collapsedPreview}</div> : null}
          </div>

          <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-[var(--sabbia-50)] px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
            {isOpen ? "Collapse" : "Expand"}
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
            >
              <path
                d="M2.5 4.5 6 8l3.5-3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
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

function FinanceTrendLineChart({
  points,
  projection,
  currency,
}: {
  points: FinanceMonthlyTrendPoint[];
  projection: FinanceTrendProjection | null;
  currency: FinanceCurrency;
}) {
  const data = [
    ...points.map((point) => ({
      key: point.month,
      label: formatShortMonthLabel(point.month),
      fullLabel: point.label,
      value: point.net_total,
      projected: false,
    })),
    ...(projection
      ? [
          {
            key: `${projection.month}:projection`,
            label: `${formatShortMonthLabel(projection.month)} proj`,
            fullLabel: `Projected ${formatMonthLabel(projection.month)}`,
            value: projection.net_total,
            projected: true,
          },
        ]
      : []),
  ];

  const chartWidth = 100;
  const chartHeight = 64;
  const paddingX = data.length === 1 ? 50 : 8;
  const paddingY = 6;
  const baselineY = chartHeight - paddingY;
  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;

  const coordinates = data.map((point, index) => ({
    ...point,
    x:
      data.length === 1
        ? chartWidth / 2
        : paddingX + (usableWidth * index) / Math.max(data.length - 1, 1),
    y: baselineY - (point.value / maxValue) * usableHeight,
  }));

  const actualCoordinates = coordinates.filter((point) => !point.projected);
  const projectedCoordinate = coordinates.find((point) => point.projected) ?? null;
  const actualPath = actualCoordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath =
    actualCoordinates.length > 0
      ? `${actualPath} L ${actualCoordinates.at(-1)?.x ?? 0} ${baselineY} L ${actualCoordinates[0].x} ${baselineY} Z`
      : "";
  const projectionPath =
    projectedCoordinate && actualCoordinates.length > 0
      ? `M ${actualCoordinates.at(-1)?.x ?? 0} ${actualCoordinates.at(-1)?.y ?? 0} L ${projectedCoordinate.x} ${projectedCoordinate.y}`
      : "";

  return (
    <div className="rounded-2xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-48 w-full" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = baselineY - usableHeight * ratio;

          return (
            <line
              key={ratio}
              x1={paddingX}
              y1={y}
              x2={chartWidth - paddingX}
              y2={y}
              stroke="var(--sabbia-200)"
              strokeWidth="0.6"
              strokeDasharray="2 2"
            />
          );
        })}

        {actualCoordinates.length > 1 ? (
          <path d={areaPath} fill="var(--sabbia-100)" opacity="0.9" />
        ) : null}

        {actualCoordinates.length > 1 ? (
          <path d={actualPath} fill="none" stroke="var(--ink-900)" strokeWidth="2.4" />
        ) : null}

        {projectionPath ? (
          <path
            d={projectionPath}
            fill="none"
            stroke="var(--trad-red-500)"
            strokeWidth="2"
            strokeDasharray="3 3"
          />
        ) : null}

        {actualCoordinates.map((point) => (
          <circle
            key={point.key}
            cx={point.x}
            cy={point.y}
            r="1.8"
            fill="var(--ink-900)"
          />
        ))}

        {projectedCoordinate ? (
          <circle
            cx={projectedCoordinate.x}
            cy={projectedCoordinate.y}
            r="2"
            fill="white"
            stroke="var(--trad-red-500)"
            strokeWidth="1.6"
          />
        ) : null}
      </svg>

      <div
        className="mt-4 grid gap-2 text-xs text-foreground-muted"
        style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
      >
        {data.map((point) => (
          <div
            key={point.key}
            className={`rounded-xl px-3 py-2 ${point.projected ? "bg-amber-50" : "bg-[var(--sabbia-50)]/80"}`}
          >
            <p className="font-medium text-foreground">{point.label}</p>
            <p className="mt-1">{formatMoney(point.value, currency)}</p>
            <p className="mt-1 text-[11px]">{point.fullLabel}</p>
          </div>
        ))}
      </div>
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
  const [entryFormScrollKey, setEntryFormScrollKey] = useState(0);
  const [sessionTotalAmount, setSessionTotalAmount] = useState("");
  const [showStudioSplitOverride, setShowStudioSplitOverride] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  const [visibleProjectCount, setVisibleProjectCount] = useState(DEFAULT_VISIBLE_PROJECTS);
  const [bulkEntryMode, setBulkEntryMode] = useState<BulkEntryMode>("single");
  const [bulkEntryDates, setBulkEntryDates] = useState("");
  const financeEntryAnchorRef = useRef<HTMLDivElement | null>(null);
  const financeFormRef = useRef<HTMLDivElement | null>(null);
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
  const normalizedProjectSearch = projectSearch.trim().toLowerCase();
  const filteredMonthlyProjects = useMemo(() => {
    if (!normalizedProjectSearch) return monthlyProjects;

    return monthlyProjects.filter((project) => {
      const searchableText = [
        project.project_label,
        project.client_name,
        project.session_date,
        getContextLabel(project.work_context, dashboard?.context_settings),
        ...project.payments.flatMap((payment) => [
          payment.payment_label,
          payment.payment_date,
          FINANCE_PAYMENT_METHOD_LABELS[payment.payment_method],
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedProjectSearch);
    });
  }, [dashboard?.context_settings, monthlyProjects, normalizedProjectSearch]);

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

    const timeout = window.setTimeout(() => {
      if (document.activeElement instanceof HTMLButtonElement) {
        document.activeElement.blur();
      }

      const scrollTarget = financeFormRef.current ?? financeEntryAnchorRef.current;
      scrollTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    return () => window.clearTimeout(timeout);
  }, [financeView, showForm, entryFormScrollKey]);

  useEffect(() => {
    setVisibleProjectCount(DEFAULT_VISIBLE_PROJECTS);
  }, [month, normalizedProjectSearch]);

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
  const projectPaymentCount = useMemo(
    () => monthlyProjects.reduce((sum, project) => sum + project.payments.length, 0),
    [monthlyProjects]
  );
  const visibleMonthlyProjects = useMemo(
    () => filteredMonthlyProjects.slice(0, visibleProjectCount),
    [filteredMonthlyProjects, visibleProjectCount]
  );
  const hasHiddenProjects = filteredMonthlyProjects.length > visibleProjectCount;

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
  const trendProjection = useMemo(
    () => getTrendProjection(summary?.monthly_trend ?? []),
    [summary?.monthly_trend]
  );

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
    setBulkEntryMode("single");
    setBulkEntryDates("");
  }

  function revealEntryForm() {
    setFinanceView("operations");
    setShowForm(true);
    setEntryFormScrollKey((current) => current + 1);
  }

  function hideEntryForm(nextMonth = month, nextDashboard = dashboard) {
    setShowForm(false);
    resetForm(nextMonth, nextDashboard);
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
  const parsedBulkEntryDates = useMemo(
    () =>
      Array.from(
        new Set(
          bulkEntryDates
            .split(/[\n,]+/)
            .map((value) => value.trim())
            .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
        )
      ),
    [bulkEntryDates]
  );
  const bulkEntryInvalidTokens = useMemo(
    () =>
      bulkEntryDates
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter((value) => value.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(value)),
    [bulkEntryDates]
  );

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

  function openEntryFormWithDraft(nextForm: FinanceFormState) {
    revealEntryForm();
    setEditingEntry(null);
    setSessionTotalAmount("");
    setShowStudioSplitOverride(nextForm.studio_fee_base_amount.trim().length > 0);
    setBulkEntryMode("single");
    setBulkEntryDates("");
    setForm(nextForm);
  }

  function startDuplicatePayment(project: FinanceProjectWithPayments, paymentId: string) {
    const payment = project.payments.find((item) => item.id === paymentId);
    if (!payment) return;

    const nextMonthDate = `${month}-01`;
    const clonedForm = buildFormStateFromExistingEntry(project, payment);

    openEntryFormWithDraft({
      ...clonedForm,
      booking_id: project.booking_id ?? "",
      payment_date: nextMonthDate,
      session_date: project.session_date?.startsWith(month)
        ? project.session_date ?? ""
        : "",
      invoice_reference: "",
    });
  }

  function startSimilarProject(project: FinanceProjectWithPayments, paymentId: string) {
    const payment = project.payments.find((item) => item.id === paymentId);
    if (!payment) return;

    const nextMonthDate = `${month}-01`;
    const clonedForm = buildFormStateFromExistingEntry(project, payment);

    openEntryFormWithDraft({
      ...clonedForm,
      booking_id: "",
      client_name: project.client_name,
      project_label: project.project_label,
      session_date: "",
      payment_date: nextMonthDate,
      invoice_reference: "",
    });
  }

  function startEditingEntry(project: FinanceProjectWithPayments, paymentId: string) {
    const payment = project.payments.find((item) => item.id === paymentId);
    if (!payment || !dashboard) return;

    revealEntryForm();
    setEditingEntry({ projectId: project.id, paymentId: payment.id });
    setSessionTotalAmount("");
    setShowStudioSplitOverride(payment.studio_fee_base_amount !== null);
    setForm(buildFormStateFromExistingEntry(project, payment));
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
      if (showStudioSplitOverride) {
        if (!form.studio_fee_base_amount.trim()) {
          throw new Error("Add a studio split amount or turn off the custom split override");
        }

        if (!form.studio_fee_base_currency) {
          throw new Error("Select a studio split currency for the custom split amount");
        }
      }

      const isEditing = editingEntry !== null;
      const basePayload = {
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
      };

      if (!isEditing && basePayload.studio_fee_base_amount === null) {
        delete (basePayload as { studio_fee_base_amount?: number | null }).studio_fee_base_amount;
      }

      if (!isEditing && basePayload.studio_fee_base_currency === null) {
        delete (basePayload as { studio_fee_base_currency?: FinanceCurrency | null }).studio_fee_base_currency;
      }

      if (!isEditing && bulkEntryMode === "multiple") {
        if (parsedBulkEntryDates.length === 0) {
          throw new Error("Add at least one valid payment date for the multi-entry helper");
        }

        if (bulkEntryInvalidTokens.length > 0) {
          throw new Error("One or more bulk dates are invalid. Use YYYY-MM-DD.");
        }

        let latestDashboard: FinanceDashboardResponse | null = null;

        for (const paymentDate of parsedBulkEntryDates) {
          const response = await fetch("/api/admin/finance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...basePayload,
              payment_date: paymentDate,
              session_date:
                form.session_date && form.session_date.startsWith(month) ? paymentDate : form.session_date,
            }),
          });

          if (response.status === 401) {
            router.push("/admin/login");
            return;
          }

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "Failed to create finance entries");
          }

          latestDashboard = data as FinanceDashboardResponse;
        }

        if (!latestDashboard) {
          throw new Error("No finance entries were created");
        }

        setDashboard(latestDashboard);
        setMonth(latestDashboard.month);
        hideEntryForm(latestDashboard.month, latestDashboard);
        setSuccess(
          `${parsedBulkEntryDates.length} similar finance entr${parsedBulkEntryDates.length === 1 ? "y" : "ies"} saved.`
        );
        return;
      }

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
          ...basePayload,
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
      hideEntryForm(nextDashboard.month, nextDashboard);
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
        hideEntryForm((data as FinanceDashboardResponse).month, data as FinanceDashboardResponse);
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
    const paymentFees = summary.processor_fee_approx_totals_by_reporting_currency[currency];
    const bucketTotal = takeHome + studioFees + paymentFees;
    const bucketSegments = [
      {
        label: "Studio fees",
        value: studioFees,
        color: "var(--trad-red-500)",
      },
      {
        label: "Payment fees",
        value: paymentFees,
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
        className="h-full rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4"
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
            <span className="text-foreground-muted">Payment fees</span>
            <span className="text-foreground">
              {formatMoney(paymentFees, currency)}
            </span>
          </div>
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
              if (financeView !== "operations" || !showForm) {
                revealEntryForm();
                return;
              }
              hideEntryForm();
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
                  : `${keepSummary.payment_count} payment${keepSummary.payment_count === 1 ? "" : "s"} after studio split + fees`
              }
            />
            <AdminMetricCard
              label="Disposable estimate"
              tone="accent"
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
            <AdminMetricCard
              label="Studio fees due"
              value={
                loading || !summary
                  ? "..."
                  : `${formatMoney(summary.studio_fee_totals_by_reporting_currency.SEK, "SEK")} · ${formatMoney(summary.studio_fee_totals_by_reporting_currency.DKK, "DKK")} · ${formatMoney(summary.studio_fee_totals_by_reporting_currency.EUR, "EUR")}`
              }
              valueClassName="text-lg leading-tight sm:text-xl"
              detail="Grouped by local payout bucket, not forced into one fake currency."
            />
            <AdminMetricCard
              label="SumUp fees"
              value={
                loading || !summary
                  ? "..."
                  : formatMoney(summary.processor_fee_totals_by_processor_currency.EUR, "EUR")
              }
              detail="Same fee family as payment fees for now, but kept separate so other processors can later behave differently."
            />
          </div>

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
              label={`Normalized ${summary?.approx_secondary.currency ?? "EUR"}`}
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
                  : `Converted cash-kept overview only, not disposable money · ${getApproxRateSourceLabel(summary.approx_secondary.source)}`
              }
            />
            <AdminMetricCard
              label="Trend direction"
              value={loading || !summary ? "..." : formatDelta(summary.comparison.percent_delta)}
              detail={
                loading || !summary
                  ? ""
                  : `${formatMonthLabel(previousMonth)} to ${formatMonthLabel(month)}`
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
                  <p className="mt-3 text-xs text-foreground-muted">
                    Payment fees currently mean SumUp drag. The label stays broader so PayPal, bank, or future processor-specific semantics can split out cleanly later.
                  </p>
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
                  note="This split uses all monthly payments. Studio share and payment fees leave first; the rest is the actual cash pool Lia has in hand."
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
              <div className="grid gap-4 md:grid-cols-2 md:items-end xl:grid-cols-4 2xl:grid-cols-5">
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
                            className="!min-h-[36px] !px-3 !py-1.5 text-xs"
                            disabled={saving}
                            onClick={() => startEditingExpense(expense)}
                          >
                            Edit
                          </AdminButton>
                          <AdminButton
                            variant="ghost"
                            className="!min-h-[36px] !px-3 !py-1.5 text-xs"
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
        <div ref={financeFormRef}>
          <AdminSurface className="mb-6">
          <AdminSectionHeading
            title={financeFormHeading}
            description={financeFormDescription}
          />

          <form className="grid gap-5 pb-28 lg:pb-0" onSubmit={handleCreateEntry}>
            <FinanceFormSection
              title="Session setup"
              description="Who, where, and when this payment belongs to."
            >
              {!editingEntry ? (
                <div className="mb-4 rounded-2xl border border-[var(--sabbia-200)] bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminButton
                      type="button"
                      variant={bulkEntryMode === "single" ? "primary" : "secondary"}
                      className="!min-h-[36px] !px-3 !py-1.5 text-xs"
                      onClick={() => setBulkEntryMode("single")}
                    >
                      Single entry
                    </AdminButton>
                    <AdminButton
                      type="button"
                      variant={bulkEntryMode === "multiple" ? "primary" : "secondary"}
                      className="!min-h-[36px] !px-3 !py-1.5 text-xs"
                      onClick={() => setBulkEntryMode("multiple")}
                    >
                      Multiple similar entries
                    </AdminButton>
                  </div>

                  {bulkEntryMode === "multiple" ? (
                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                      <label className="text-sm text-foreground-muted">
                        Payment dates
                        <textarea
                          value={bulkEntryDates}
                          onChange={(event) => setBulkEntryDates(event.target.value)}
                          placeholder={`One date per line\n${month}-01\n${month}-08\n${month}-16`}
                          className="mt-1 min-h-[120px] w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                          style={{ fontSize: "16px" }}
                        />
                      </label>

                      <div className="rounded-xl bg-[var(--sabbia-50)] px-4 py-3 text-sm text-foreground-muted">
                        <p className="font-medium text-foreground">How it works</p>
                        <p className="mt-2">
                          This creates one fresh project + payment per date, using the same details, amount, fee setup, and notes.
                        </p>
                        <p className="mt-2 text-xs">
                          Valid dates: {parsedBulkEntryDates.length}
                          {bulkEntryInvalidTokens.length > 0
                            ? ` · Invalid: ${bulkEntryInvalidTokens.join(", ")}`
                            : " · Format: YYYY-MM-DD"}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

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
                        {booking.client_name} · {booking.type} · {booking.location === "copenhagen" ? "Copenhagen / Good Morning Tattoo studio" : "Malmö / Diamant studio"}
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
              description="Start from what the client actually paid, then only turn on a separate split base when real life gets messier than the default."
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
                <div className="grid gap-4 md:grid-cols-2 md:items-start">
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
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">Studio split</p>
                        <p className="mt-1 text-xs text-foreground-muted">
                          Default: follow the client payment amount and currency.
                        </p>
                      </div>

                      <AdminCheckboxCard
                        checked={showStudioSplitOverride}
                        onChange={(checked) => {
                          setShowStudioSplitOverride(checked);
                          if (!checked) {
                            updateForm("studio_fee_base_amount", "");
                            return;
                          }

                          if (!form.studio_fee_base_currency) {
                            updateForm("studio_fee_base_currency", form.reporting_currency);
                          }
                        }}
                        label="Use separate split base"
                        description={
                          form.payment_method === "card"
                            ? "Use this when the client pays in one currency, but the studio share should be calculated from another local amount."
                            : "Use this only when the studio percentage should be based on another amount than the payment received."
                        }
                        className="bg-[var(--sabbia-50)] shadow-none"
                      />
                    </div>

                    {showStudioSplitOverride ? (
                      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.8fr)] md:items-end">
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
                        Studio split follows the same amount and currency as the client payment.
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

                  <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
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

                    <div className="flex items-end md:pb-0.5">
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

            <div className="sticky bottom-3 z-20 -mx-1 mt-1 px-1 lg:static lg:mx-0 lg:px-0">
              <div className="flex flex-col gap-2 rounded-2xl border border-[var(--sabbia-200)] bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:flex-wrap sm:justify-end lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-0">
                <AdminButton variant="primary" type="submit" disabled={saving} className="w-full sm:w-auto">
                  {saving
                    ? "Saving..."
                    : editingEntry
                      ? "Save finance changes"
                      : "Save finance entry"}
                </AdminButton>
                <AdminButton
                  variant="secondary"
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => hideEntryForm()}
                >
                  Cancel
                </AdminButton>
              </div>
            </div>
          </form>
          </AdminSurface>
        </div>
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
              <div className={`grid gap-4 ${getReportingBucketGridClass(Math.max(reportingBucketCurrencies.length, 1))}`}>
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
                        <span>Payment fees</span>
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
          description="Cash-kept trend in the primary reporting currency, with a lightweight next-month projection based on the recent run rate."
          collapsedPreview={
            loading || !summary || summary.monthly_trend.length === 0 ? null : (
              <div className="grid gap-2 text-xs text-foreground-muted sm:grid-cols-3">
                <div className="rounded-xl bg-[var(--sabbia-50)] px-3 py-2">
                  <p className="font-medium text-foreground">
                    {formatMoney(latestTrendPoint?.net_total ?? 0, summary.approx_primary.currency)}
                  </p>
                  <p>{latestTrendPoint?.label ?? "Latest month"}</p>
                </div>
                <div className="rounded-xl bg-[var(--sabbia-50)] px-3 py-2">
                  <p className="font-medium text-foreground">{formatDelta(summary.comparison.percent_delta)}</p>
                  <p>vs last month</p>
                </div>
                <div className="rounded-xl bg-[var(--sabbia-50)] px-3 py-2">
                  <p className="font-medium text-foreground">
                    {trendProjection
                      ? formatMoney(trendProjection.net_total, summary.approx_primary.currency)
                      : "Need 2+ months"}
                  </p>
                  <p>{trendProjection ? `${formatShortMonthLabel(trendProjection.month)} projection` : "Projection"}</p>
                </div>
              </div>
            )
          }
        >

          {loading ? (
            <p className="text-sm text-foreground-muted">Loading trend...</p>
          ) : summary && summary.monthly_trend.length > 0 ? (
            <div className="space-y-4">
              <FinanceTrendLineChart
                points={summary.monthly_trend}
                projection={trendProjection}
                currency={summary.approx_primary.currency}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[var(--sabbia-50)] px-4 py-3 text-xs text-foreground-muted">
                  <p className="font-medium text-foreground">Latest month</p>
                  <p className="mt-1">
                    {latestTrendPoint
                      ? `${latestTrendPoint.label}: ${formatMoney(latestTrendPoint.net_total, summary.approx_primary.currency)}`
                      : "No completed month yet"}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--sabbia-50)] px-4 py-3 text-xs text-foreground-muted">
                  <p className="font-medium text-foreground">Direction</p>
                  <p className="mt-1">{formatDelta(summary.comparison.percent_delta)}</p>
                </div>
                <div className="rounded-2xl bg-[var(--sabbia-50)] px-4 py-3 text-xs text-foreground-muted">
                  <p className="font-medium text-foreground">Projection</p>
                  <p className="mt-1">
                    {trendProjection
                      ? `${formatShortMonthLabel(trendProjection.month)} around ${formatMoney(trendProjection.net_total, summary.approx_primary.currency)}`
                      : "Shows after at least 2 months of payments"}
                  </p>
                </div>
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
            description="Seasonality in one place: cash kept, studio drag, payment-fee drag, and pending invoice reminders across the last six months."
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
                        Payment fees
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
            description="A six-month view of what each studio or context reserve needed per month, with payment-fee drag attached to that bucket."
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
                    <th className="px-4 py-3 font-medium">Payment fees</th>
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
      <div className="space-y-6">
          <CollapsibleFinanceSection
            title="Studio / context totals"
            description="Grouped by actual work context and native reporting bucket, so Malmö, Copenhagen, Friuli, Turin, and touring stop bleeding into a fake currency view."
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
            description="Scan the month in wide project rows first, then expand only the ones that need full payment detail."
            defaultOpen
            collapsedPreview={
              loading ? null : monthlyProjects.length > 0 ? (
                <div className="grid gap-2 text-xs text-foreground-muted sm:grid-cols-3">
                  <div className="rounded-xl bg-[var(--sabbia-50)] px-3 py-2">
                    <p className="font-medium text-foreground">{filteredMonthlyProjects.length}</p>
                    <p>project{filteredMonthlyProjects.length === 1 ? "" : "s"} shown</p>
                  </div>
                  <div className="rounded-xl bg-[var(--sabbia-50)] px-3 py-2">
                    <p className="font-medium text-foreground">{projectPaymentCount}</p>
                    <p>payment line{projectPaymentCount === 1 ? "" : "s"}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--sabbia-50)] px-3 py-2">
                    <p className="font-medium text-foreground">Open project</p>
                    <p>Each project row opens full payment details</p>
                  </div>
                </div>
              ) : null
            }
          >

            {loading ? (
              <p className="text-sm text-foreground-muted">Loading projects...</p>
            ) : monthlyProjects.length > 0 ? (
              <div className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <label className="text-sm text-foreground-muted">
                    Search this month
                    <input
                      value={projectSearch}
                      onChange={(event) => setProjectSearch(event.target.value)}
                      placeholder="Client, project, context, payment label"
                      className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                      style={{ fontSize: "16px" }}
                    />
                  </label>

                  <div className="grid gap-2 text-xs text-foreground-muted sm:grid-cols-3">
                    <div className="rounded-xl bg-[var(--sabbia-50)] px-3 py-2">
                      <p className="font-medium text-foreground">{filteredMonthlyProjects.length}</p>
                      <p>project{filteredMonthlyProjects.length === 1 ? "" : "s"} shown</p>
                    </div>
                    <div className="rounded-xl bg-[var(--sabbia-50)] px-3 py-2">
                      <p className="font-medium text-foreground">{projectPaymentCount}</p>
                      <p>payment line{projectPaymentCount === 1 ? "" : "s"}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--sabbia-50)] px-3 py-2">
                      <p className="font-medium text-foreground">{invoiceReminderGroups.length}</p>
                      <p>invoice reminder{invoiceReminderGroups.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                </div>

                {normalizedProjectSearch && filteredMonthlyProjects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--sabbia-300)] bg-[var(--sabbia-50)]/80 px-4 py-5 text-sm text-foreground-muted">
                    No project matches that search in {formatMonthLabel(month)}.
                  </div>
                ) : null}

                <div className="space-y-3">
                  {visibleMonthlyProjects.map((project) => {
                    const latestPayment = project.payments[0] ?? null;
                    const totalGross = project.payments.reduce((sum, payment) => sum + payment.gross_amount, 0);
                    const totalNetReporting = project.payments.reduce((sum, payment) => sum + payment.net_amount, 0);
                    const totalFees = project.payments.reduce((sum, payment) => sum + payment.fee_amount, 0);
                    const totalProcessorFees = project.payments.reduce(
                      (sum, payment) => sum + payment.processor_fee_amount,
                      0
                    );
                    const openInvoiceCount = project.payments.filter(
                      (payment) => payment.invoice_needed && !payment.invoice_done
                    ).length;
                    const isExpanded = expandedProjectIds.includes(project.id);

                    return (
                      <details
                        key={project.id}
                        open={isExpanded}
                        onToggle={(event) => {
                          const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                          setExpandedProjectIds((current) =>
                            nextOpen
                              ? current.includes(project.id)
                                ? current
                                : [...current, project.id]
                              : current.filter((id) => id !== project.id)
                          );
                        }}
                        className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/60 p-4"
                      >
                        <summary className="list-none cursor-pointer">
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] lg:items-start">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">
                                  {project.project_label}
                                </p>
                                {project.booking_id ? (
                                  <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] text-foreground-muted shadow-sm">
                                    linked booking
                                  </span>
                                ) : null}
                                {openInvoiceCount > 0 ? (
                                  <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] text-amber-700">
                                    {openInvoiceCount} invoice pending
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-foreground-muted">
                                {project.client_name} · {getContextLabel(project.work_context, dashboard?.context_settings)}
                                {project.session_date ? ` · session ${project.session_date}` : ""}
                              </p>
                              {latestPayment ? (
                                <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-foreground-muted shadow-sm">
                                  <p className="font-medium text-foreground">Latest payment preview</p>
                                  <p className="mt-1">
                                    {latestPayment.payment_label} · {latestPayment.payment_date} · {FINANCE_PAYMENT_METHOD_LABELS[latestPayment.payment_method]}
                                  </p>
                                  <p className="mt-1">
                                    Charged {formatMoney(latestPayment.gross_amount, latestPayment.currency)} · kept {formatMoney(latestPayment.original_net_amount, latestPayment.currency)}
                                  </p>
                                </div>
                              ) : null}
                            </div>

                            <div className="grid gap-2 text-xs text-foreground-muted sm:grid-cols-2 xl:grid-cols-2">
                              <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                                <p className="font-medium text-foreground">{project.payments.length}</p>
                                <p>payment{project.payments.length === 1 ? "" : "s"}</p>
                              </div>
                              <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                                <p className="font-medium text-foreground">
                                  {latestPayment ? formatMoney(totalGross, latestPayment.currency) : "-"}
                                </p>
                                <p>charged total</p>
                              </div>
                              <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                                <p className="font-medium text-foreground">
                                  {latestPayment
                                    ? formatMoney(totalFees, latestPayment.reporting_currency)
                                    : "-"}
                                </p>
                                <p>studio fees</p>
                              </div>
                              <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                                <p className="font-medium text-foreground">
                                  {latestPayment
                                    ? formatMoney(totalNetReporting, latestPayment.reporting_currency)
                                    : "-"}
                                </p>
                                <p>cash kept</p>
                              </div>
                            </div>

                            <div className="flex justify-start lg:justify-end">
                              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-foreground shadow-sm">
                                {isExpanded ? "Hide payments" : `Show ${project.payments.length} payment${project.payments.length === 1 ? "" : "s"}`}
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                  className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                >
                                  <path
                                    d="M2.5 4.5 6 8l3.5-3.5"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                            </div>
                          </div>
                        </summary>

                        {project.payments.length > 0 ? (
                          <div className="mt-4 space-y-3 border-t border-[var(--sabbia-200)] pt-4">
                            {project.payments.map((payment) => (
                              <div key={payment.id} className="rounded-xl bg-white p-4 shadow-sm">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-medium text-foreground">
                                        {payment.payment_label}
                                      </p>
                                      <span className="rounded-full bg-[var(--sabbia-50)] px-2.5 py-1 text-[11px] text-foreground-muted">
                                        {FINANCE_PAYMENT_METHOD_LABELS[payment.payment_method]}
                                      </span>
                                      <span className="rounded-full bg-[var(--sabbia-50)] px-2.5 py-1 text-[11px] text-foreground-muted">
                                        {payment.payment_date}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-xs text-foreground-muted">
                                      Paid in {payment.currency} · reports in {payment.reporting_currency}
                                      {payment.currency !== payment.reporting_currency
                                        ? " · converted for local bucket visibility"
                                        : ""}
                                    </p>
                                  </div>

                                  <div className="grid gap-2 text-xs text-foreground-muted sm:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-xl bg-[var(--sabbia-50)] px-3 py-2">
                                      <p className="font-medium text-foreground">
                                        {formatMoney(payment.gross_amount, payment.currency)}
                                      </p>
                                      <p>charged</p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--sabbia-50)] px-3 py-2">
                                      <p className="font-medium text-foreground">
                                        {formatMoney(payment.fee_amount, payment.reporting_currency)}
                                      </p>
                                      <p>studio fee</p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--sabbia-50)] px-3 py-2">
                                      <p className="font-medium text-foreground">
                                        {formatMoney(payment.processor_fee_amount, payment.processor_fee_currency)}
                                      </p>
                                      <p>payment fee</p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--sabbia-50)] px-3 py-2">
                                      <p className="font-medium text-foreground">
                                        {formatMoney(payment.original_net_amount, payment.currency)}
                                      </p>
                                      <p>cash kept</p>
                                    </div>
                                  </div>
                                </div>

                                {payment.currency !== payment.reporting_currency ? (
                                  <p className="mt-3 text-xs text-foreground-muted">
                                    Reporting view {formatMoney(payment.net_amount, payment.reporting_currency)} · studio fee and bucket totals stay local to {payment.reporting_currency}.
                                  </p>
                                ) : null}

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                  <AdminButton
                                    variant="secondary"
                                    className="!min-h-[36px] !px-3 !py-1.5 text-xs"
                                    disabled={saving}
                                    onClick={() => startEditingEntry(project, payment.id)}
                                  >
                                    Edit
                                  </AdminButton>
                                  <AdminButton
                                    variant="secondary"
                                    className="!min-h-[36px] !px-3 !py-1.5 text-xs"
                                    disabled={saving}
                                    onClick={() => startDuplicatePayment(project, payment.id)}
                                  >
                                    Duplicate payment
                                  </AdminButton>
                                  <AdminButton
                                    variant="secondary"
                                    className="!min-h-[36px] !px-3 !py-1.5 text-xs"
                                    disabled={saving}
                                    onClick={() => startSimilarProject(project, payment.id)}
                                  >
                                    Similar project
                                  </AdminButton>
                                  <AdminButton
                                    variant="ghost"
                                    className="!min-h-[36px] !px-3 !py-1.5 text-xs"
                                    disabled={saving}
                                    onClick={() => handleDeleteEntry(project.id, payment.id)}
                                  >
                                    Delete
                                  </AdminButton>
                                  <span className="rounded-full bg-[var(--sabbia-50)] px-2.5 py-1 text-foreground-muted">
                                    {payment.fee_percentage}% studio fee
                                  </span>
                                  <span className="rounded-full bg-[var(--sabbia-50)] px-2.5 py-1 text-foreground-muted">
                                    {payment.processor_fee_percentage}% SumUp fee
                                  </span>
                                  {payment.invoice_needed ? (
                                    <button
                                      onClick={() =>
                                        handleToggleInvoiceDone(project, payment.id, !payment.invoice_done)
                                      }
                                      className={`inline-flex min-h-[36px] items-center justify-center rounded-full px-3 py-1.5 text-xs transition-colors ${
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

                            <div className="grid gap-2 text-xs text-foreground-muted sm:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                                <p className="font-medium text-foreground">
                                  {latestPayment
                                    ? formatMoney(totalProcessorFees, latestPayment.processor_fee_currency)
                                    : "-"}
                                </p>
                                  <p>total payment fees</p>
                              </div>
                              <div className="rounded-xl bg-white px-3 py-2 shadow-sm sm:col-span-2 xl:col-span-3">
                                <p className="font-medium text-foreground">Fast repeat-entry shortcuts</p>
                                <p className="mt-1">
                                  Use “Duplicate payment” when it is basically the same project/payment again. Use “Similar project” when the details are almost identical but it should become a fresh project row.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-foreground-muted shadow-sm">
                            Session tracked for this month, but no payment line has been logged yet.
                          </div>
                        )}
                      </details>
                    );
                  })}
                </div>

                {hasHiddenProjects ? (
                  <div className="flex justify-center">
                    <AdminButton
                      variant="secondary"
                      onClick={() =>
                        setVisibleProjectCount((current) => current + DEFAULT_VISIBLE_PROJECTS)
                      }
                    >
                      Show {Math.min(DEFAULT_VISIBLE_PROJECTS, filteredMonthlyProjects.length - visibleProjectCount)} more project{filteredMonthlyProjects.length - visibleProjectCount === 1 ? "" : "s"}
                    </AdminButton>
                  </div>
                ) : null}
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
                          className="!min-h-[36px] !px-3 !py-1.5 text-xs"
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
                          className="!min-h-[36px] !px-3 !py-1.5 text-xs"
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
