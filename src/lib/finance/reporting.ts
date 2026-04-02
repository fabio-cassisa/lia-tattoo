import {
  calculateFeeAmount,
  calculateProcessorFeeAmount,
} from "@/lib/finance/config";
import type {
  FinanceCurrency,
  FinancePaymentRow,
  FinanceProjectRow,
  FinanceSettingsRow,
} from "@/lib/supabase/database.types";
import type {
  FinanceComparison,
  FinanceContextFeeSummary,
  FinanceInvoiceReminder,
  FinanceMonthlyTrendPoint,
  FinancePaymentDerived,
  FinanceProjectWithPayments,
  FinanceWeeklySummary,
} from "@/lib/finance/types";

type ResolvedExchangeRates = {
  source: "live" | "fallback";
  eur_to_sek: number;
  eur_to_dkk: number;
  sek_to_eur: number;
  dkk_to_eur: number;
};

const CARD_PROCESSOR_CURRENCY: FinanceCurrency = "EUR";

const DEFAULT_EUR_TO_SEK = 11.6;
const DEFAULT_EUR_TO_DKK = 7.46;

export function getCurrentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getPreviousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return getCurrentMonthKey(date);
}

export function normalizeMonthKey(monthKey?: string | null): string {
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
    return monthKey;
  }

  return getCurrentMonthKey();
}

export function getPaymentMonthKey(paymentDate: string): string {
  return paymentDate.slice(0, 7);
}

export function derivePayment(
  payment: FinancePaymentRow,
  rates?: ResolvedExchangeRates
): FinancePaymentDerived {
  const gross_amount_reporting = rates
    ? convertAmount(payment.gross_amount, payment.currency, payment.reporting_currency, rates)
    : payment.gross_amount;
  const fee_amount = calculateFeeAmount(gross_amount_reporting, payment.fee_percentage);
  const processor_fee_currency: FinanceCurrency =
    payment.payment_method === "card" ? CARD_PROCESSOR_CURRENCY : payment.currency;
  const gross_amount_processor =
    processor_fee_currency === payment.currency
      ? payment.gross_amount
      : rates
        ? convertAmount(payment.gross_amount, payment.currency, processor_fee_currency, rates)
        : payment.gross_amount;
  const processor_fee_amount = calculateProcessorFeeAmount(
    gross_amount_processor,
    payment.processor_fee_percentage
  );
  const processor_fee_amount_reporting = rates
    ? convertAmount(
        processor_fee_amount,
        processor_fee_currency,
        payment.reporting_currency,
        rates
      )
    : processor_fee_amount;
  const net_amount = roundMoney(
    gross_amount_reporting - fee_amount - processor_fee_amount_reporting
  );

  return {
    ...payment,
    gross_amount_reporting,
    fee_amount,
    processor_fee_currency,
    processor_fee_amount,
    processor_fee_amount_reporting,
    net_amount,
  };
}

export function buildProjectsWithPayments(
  projects: FinanceProjectRow[],
  payments: FinancePaymentRow[],
  rates?: ResolvedExchangeRates
): FinanceProjectWithPayments[] {
  const paymentsByProject = new Map<string, FinancePaymentDerived[]>();

  for (const payment of payments) {
    const list = paymentsByProject.get(payment.project_id) ?? [];
    list.push(derivePayment(payment, rates));
    paymentsByProject.set(payment.project_id, list);
  }

  return projects
    .map((project) => ({
      ...project,
      payments: (paymentsByProject.get(project.id) ?? []).sort((a, b) =>
        b.payment_date.localeCompare(a.payment_date)
      ),
    }))
    .sort((a, b) => {
      const aDate = a.session_date ?? a.created_at;
      const bDate = b.session_date ?? b.created_at;
      return bDate.localeCompare(aDate);
    });
}

export function filterProjectsForMonth(
  projects: FinanceProjectWithPayments[],
  monthKey: string
): FinanceProjectWithPayments[] {
  return projects.filter((project) => {
    if (project.payments.some((payment) => getPaymentMonthKey(payment.payment_date) === monthKey)) {
      return true;
    }

    return project.payments.length === 0 && project.session_date?.startsWith(monthKey);
  });
}

export function buildInvoiceReminders(
  projects: FinanceProjectWithPayments[]
): FinanceInvoiceReminder[] {
  return projects
    .flatMap((project) =>
      project.payments
        .filter((payment) => payment.invoice_needed && !payment.invoice_done)
        .map((payment) => ({
          ...payment,
          project_id: project.id,
          project_label: project.project_label,
          client_name: project.client_name,
          work_context: project.work_context,
        }))
    )
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
}

export function buildFallbackRates(
  settings: FinanceSettingsRow
): ResolvedExchangeRates {
  const eur_to_sek = settings.fallback_eur_to_sek ?? DEFAULT_EUR_TO_SEK;
  const sek_to_eur = settings.fallback_sek_to_eur ?? 1 / eur_to_sek;
  const dkk_to_eur = settings.fallback_dkk_to_eur ?? 1 / DEFAULT_EUR_TO_DKK;
  const eur_to_dkk = 1 / dkk_to_eur;

  return {
    source: "fallback",
    eur_to_sek,
    eur_to_dkk,
    sek_to_eur,
    dkk_to_eur,
  };
}

export async function resolveExchangeRates(
  settings: FinanceSettingsRow
): Promise<ResolvedExchangeRates> {
  const fallback = buildFallbackRates(settings);

  if (!settings.use_live_exchange_rates) {
    return fallback;
  }

  try {
    const response = await fetch(
      "https://api.frankfurter.app/latest?from=EUR&to=SEK,DKK",
      {
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      throw new Error(`Rate request failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      rates?: { SEK?: number; DKK?: number };
    };

    if (!data.rates?.SEK || !data.rates?.DKK) {
      throw new Error("Missing rate payload");
    }

    return {
      source: "live",
      eur_to_sek: data.rates.SEK,
      eur_to_dkk: data.rates.DKK,
      sek_to_eur: 1 / data.rates.SEK,
      dkk_to_eur: 1 / data.rates.DKK,
    };
  } catch {
    return fallback;
  }
}

export function convertAmount(
  amount: number,
  from: FinanceCurrency,
  to: FinanceCurrency,
  rates: ResolvedExchangeRates
): number {
  if (from === to) {
    return roundMoney(amount);
  }

  const eurAmount =
    from === "EUR"
      ? amount
      : from === "SEK"
        ? amount * rates.sek_to_eur
        : amount * rates.dkk_to_eur;

  const converted =
    to === "EUR"
      ? eurAmount
      : to === "SEK"
        ? eurAmount * rates.eur_to_sek
        : eurAmount * rates.eur_to_dkk;

  return roundMoney(converted);
}

export function getNetTotalsByCurrency(
  payments: FinancePaymentDerived[],
  field: "currency" | "reporting_currency" = "reporting_currency"
): Record<FinanceCurrency, number> {
  const totals: Record<FinanceCurrency, number> = {
    SEK: 0,
    DKK: 0,
    EUR: 0,
  };

  for (const payment of payments) {
    const currency = payment[field];
    totals[currency] = roundMoney(totals[currency] + payment.net_amount);
  }

  return totals;
}

export function getFeeTotalsByCurrency(
  payments: FinancePaymentDerived[],
  field: "currency" | "reporting_currency" | "processor_fee_currency" = "reporting_currency",
  amountField: "fee_amount" | "processor_fee_amount" | "processor_fee_amount_reporting" = "fee_amount"
): Record<FinanceCurrency, number> {
  const totals: Record<FinanceCurrency, number> = {
    SEK: 0,
    DKK: 0,
    EUR: 0,
  };

  for (const payment of payments) {
    const currency = payment[field];
    totals[currency] = roundMoney(totals[currency] + payment[amountField]);
  }

  return totals;
}

export function getFeeTotalsByContext(
  projects: FinanceProjectWithPayments[],
  monthKey: string
): FinanceContextFeeSummary[] {
  const summaryMap = new Map<string, FinanceContextFeeSummary>();

  for (const project of projects) {
    for (const payment of project.payments) {
      if (getPaymentMonthKey(payment.payment_date) !== monthKey) {
        continue;
      }

      const key = `${project.work_context}:${payment.reporting_currency}`;
      const current = summaryMap.get(key) ?? {
        work_context: project.work_context,
        reporting_currency: payment.reporting_currency,
        fee_total: 0,
        processor_fee_total: 0,
        gross_total: 0,
        net_total: 0,
        entry_count: 0,
      };

      current.fee_total = roundMoney(current.fee_total + payment.fee_amount);
      current.processor_fee_total = roundMoney(
        current.processor_fee_total + payment.processor_fee_amount_reporting
      );
      current.gross_total = roundMoney(current.gross_total + payment.gross_amount_reporting);
      current.net_total = roundMoney(current.net_total + payment.net_amount);
      current.entry_count += 1;

      summaryMap.set(key, current);
    }
  }

  return [...summaryMap.values()].sort((a, b) => {
    if (a.work_context === b.work_context) {
      return a.reporting_currency.localeCompare(b.reporting_currency);
    }

    return a.work_context.localeCompare(b.work_context);
  });
}

export function getWeekKey(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function getWeekLabel(weekKey: string): string {
  return weekKey.replace("-W", " week ");
}

export function buildWeeklySummary(
  payments: FinancePaymentDerived[],
  primaryCurrency: FinanceCurrency,
  rates: ResolvedExchangeRates
): FinanceWeeklySummary[] {
  const weekMap = new Map<string, FinanceWeeklySummary>();

  for (const payment of payments) {
    const weekKey = getWeekKey(payment.payment_date);
    const current = weekMap.get(weekKey) ?? {
      week_key: weekKey,
      label: getWeekLabel(weekKey),
      month_entry_count: 0,
      net_total: 0,
      studio_fee_total: 0,
      processor_fee_total: 0,
    };

    current.month_entry_count += 1;
    current.net_total = roundMoney(
      current.net_total + convertAmount(payment.net_amount, payment.reporting_currency, primaryCurrency, rates)
    );
    current.studio_fee_total = roundMoney(
      current.studio_fee_total + convertAmount(payment.fee_amount, payment.reporting_currency, primaryCurrency, rates)
    );
    current.processor_fee_total = roundMoney(
      current.processor_fee_total +
        convertAmount(
          payment.processor_fee_amount,
          payment.processor_fee_currency,
          primaryCurrency,
          rates
        )
    );

    weekMap.set(weekKey, current);
  }

  return [...weekMap.values()].sort((a, b) => a.week_key.localeCompare(b.week_key));
}

export function buildMonthlyTrend(
  projects: FinanceProjectWithPayments[],
  rates: ResolvedExchangeRates,
  primaryCurrency: FinanceCurrency,
  monthsToInclude = 6
): FinanceMonthlyTrendPoint[] {
  const monthMap = new Map<string, FinanceMonthlyTrendPoint>();

  for (const project of projects) {
    for (const payment of project.payments) {
      const month = getPaymentMonthKey(payment.payment_date);
      const current = monthMap.get(month) ?? {
        month,
        label: formatTrendMonth(month),
        net_total: 0,
        studio_fee_total: 0,
        processor_fee_total: 0,
        invoice_count: 0,
      };

      current.net_total = roundMoney(
        current.net_total + convertAmount(payment.net_amount, payment.reporting_currency, primaryCurrency, rates)
      );
      current.studio_fee_total = roundMoney(
        current.studio_fee_total + convertAmount(payment.fee_amount, payment.reporting_currency, primaryCurrency, rates)
      );
      current.processor_fee_total = roundMoney(
        current.processor_fee_total +
          convertAmount(
            payment.processor_fee_amount,
            payment.processor_fee_currency,
            primaryCurrency,
            rates
          )
      );
      if (payment.invoice_needed) current.invoice_count += 1;

      monthMap.set(month, current);
    }
  }

  return [...monthMap.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-monthsToInclude);
}

function formatTrendMonth(monthKey: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
  }).format(new Date(`${monthKey}-01T00:00:00`));
}

export function getApproxTotal(
  payments: FinancePaymentDerived[],
  currency: FinanceCurrency,
  rates: ResolvedExchangeRates,
  field: "currency" | "reporting_currency" = "reporting_currency"
): number {
  return roundMoney(
    payments.reduce(
      (sum, payment) =>
        sum + convertAmount(payment.net_amount, payment[field], currency, rates),
      0
    )
  );
}

export function buildComparison(
  currentAmount: number,
  previousAmount: number,
  previousMonth: string
): FinanceComparison {
  const amount_delta = roundMoney(currentAmount - previousAmount);
  const percent_delta =
    previousAmount === 0
      ? currentAmount === 0
        ? 0
        : null
      : roundMoney((amount_delta / previousAmount) * 100);

  return {
    previous_month: previousMonth,
    amount_delta,
    percent_delta,
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
