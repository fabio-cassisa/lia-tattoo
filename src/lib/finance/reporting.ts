import {
  calculateFeeAmount,
  calculateProcessorFeeAmount,
  DEFAULT_ITALY_INPS_FIXED_ANNUAL_CONTRIBUTION,
  DEFAULT_ITALY_INPS_MIN_TAXABLE_INCOME,
  DEFAULT_ITALY_INPS_REGIME,
  DEFAULT_ITALY_INPS_VARIABLE_RATE,
  DEFAULT_ITALY_PROFITABILITY_COEFFICIENT,
  DEFAULT_ITALY_STANDARD_TAX_RATE,
  DEFAULT_ITALY_STARTUP_TAX_RATE,
  DEFAULT_ITALY_TAX_LABEL,
  DEFAULT_ACTIVE_TAX_FRAMEWORK,
  DEFAULT_SWEDEN_MUNICIPAL_TAX_RATE,
  DEFAULT_SWEDEN_SELF_EMPLOYMENT_CONTRIBUTION_RATE,
  DEFAULT_SWEDEN_STATE_TAX_RATE,
  DEFAULT_SWEDEN_STATE_TAX_THRESHOLD,
  DEFAULT_SWEDEN_TAX_LABEL,
} from "@/lib/finance/config";
import type {
  FinanceCurrency,
  FinanceFixedCostRow,
  FinancePaymentRow,
  FinanceProjectRow,
  FinanceSettingsRow,
  FinanceTaxFramework,
  FinanceVariableExpenseRow,
} from "@/lib/supabase/database.types";
import type {
  FinanceComparison,
  FinanceContextFeeSummary,
  FinanceFixedCostSummary,
  FinanceInvoiceReminder,
  FinanceItalyTaxSettings,
  FinanceKeepSummary,
  FinanceMonthlyContextPayout,
  FinanceMonthlyTrendPoint,
  FinancePaymentDerived,
  FinanceProjectWithPayments,
  FinanceSwedenTaxSettings,
  FinanceTaxSummary,
  FinanceVariableExpenseSummary,
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

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function getTaxYearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) =>
    `${year}-${String(index + 1).padStart(2, "0")}`
  );
}

function sumGrossPaymentsByCurrency(
  payments: FinancePaymentDerived[],
  currency: FinanceCurrency,
  rates: ResolvedExchangeRates
): number {
  return roundMoney(
    payments.reduce(
      (total, payment) => total + convertAmount(payment.gross_amount, payment.currency, currency, rates),
      0
    )
  );
}

function getInvoicedPayments(projects: FinanceProjectWithPayments[], taxYear: number) {
  return projects
    .flatMap((project) => project.payments)
    .filter(
      (payment) => payment.invoice_done && getPaymentMonthKey(payment.payment_date).startsWith(String(taxYear))
    );
}

function getMonthlyInvoicedPayments(projects: FinanceProjectWithPayments[], monthKey: string) {
  return projects
    .flatMap((project) => project.payments)
    .filter((payment) => payment.invoice_done && getPaymentMonthKey(payment.payment_date) === monthKey);
}

function getMonthlyVariableExpenses(
  expenses: FinanceVariableExpenseRow[],
  monthKey: string
) {
  return expenses.filter((expense) => getPaymentMonthKey(expense.expense_date) === monthKey);
}

function getMonthlyVariableExpenseTotal(
  expenses: FinanceVariableExpenseRow[],
  currency: FinanceCurrency,
  rates: ResolvedExchangeRates
) {
  return roundMoney(
    expenses.reduce(
      (total, expense) => total + convertAmount(expense.amount, expense.currency, currency, rates),
      0
    )
  );
}

function getMonthlyFrameworkFixedReserve(
  fixedCosts: FinanceFixedCostRow[],
  framework: FinanceTaxFramework,
  monthKey: string,
  currency: FinanceCurrency,
  rates: ResolvedExchangeRates
) {
  const month = Number(monthKey.slice(5, 7));

  return roundMoney(
    fixedCosts
      .filter(
        (cost) =>
          cost.is_active &&
          (cost.framework === framework || cost.framework === null) &&
          !cost.already_counted_in_tax_model &&
          cost.annual_amount !== null
      )
      .reduce((total, cost) => {
        if (cost.cadence === "monthly") {
          return total + convertAmount((cost.annual_amount ?? 0) / 12, cost.currency, currency, rates);
        }

        if (cost.cadence === "quarterly") {
          return total + (cost.due_months.includes(month)
            ? convertAmount((cost.annual_amount ?? 0) / Math.max(cost.due_months.length, 1), cost.currency, currency, rates)
            : 0);
        }

        return total + (cost.due_months.includes(month)
          ? convertAmount(cost.annual_amount ?? 0, cost.currency, currency, rates)
          : 0);
      }, 0)
  );
}

function getMissingFixedCostCount(
  fixedCosts: FinanceFixedCostRow[],
  framework: FinanceTaxFramework
) {
  return fixedCosts.filter(
    (cost) =>
      cost.is_active &&
      (cost.framework === framework || cost.framework === null) &&
      !cost.already_counted_in_tax_model &&
      cost.annual_amount === null
  ).length;
}

function buildKeepScenario(
  key: "italy_current" | "italy_standard" | "sweden",
  label: string,
  framework: FinanceTaxFramework,
  active: boolean,
  monthlyPayments: FinancePaymentDerived[],
  monthlyInvoicedPayments: FinancePaymentDerived[],
  annualSimulation: FinanceTaxSummary["simulations"]["italy"] | FinanceTaxSummary["simulations"]["sweden"],
  fixedCosts: FinanceFixedCostRow[],
  variableExpenses: FinanceVariableExpenseRow[],
  monthKey: string,
  currency: FinanceCurrency,
  rates: ResolvedExchangeRates,
  notes: string[]
) {
  const grossCharged = roundMoney(
    monthlyPayments.reduce(
      (total, payment) => total + convertAmount(payment.gross_amount, payment.currency, currency, rates),
      0
    )
  );
  const cashReceived = roundMoney(
    monthlyPayments.reduce(
      (total, payment) => total + convertAmount(payment.net_amount, payment.reporting_currency, currency, rates),
      0
    )
  );
  const invoicedGross = roundMoney(
    monthlyInvoicedPayments.reduce(
      (total, payment) => total + convertAmount(payment.gross_amount, payment.currency, currency, rates),
      0
    )
  );
  const studioFees = roundMoney(
    monthlyPayments.reduce(
      (total, payment) =>
        total + convertAmount(payment.fee_amount, payment.reporting_currency, currency, rates),
      0
    )
  );
  const processorFees = roundMoney(
    monthlyPayments.reduce(
      (total, payment) =>
        total + convertAmount(payment.processor_fee_amount, payment.processor_fee_currency, currency, rates),
      0
    )
  );
  const incomeTaxReserve = roundMoney(
    invoicedGross *
      (annualSimulation.invoiced_revenue <= 0
        ? 0
        : annualSimulation.income_tax / annualSimulation.invoiced_revenue)
  );
  const variableSocialReserve = roundMoney(
    invoicedGross *
      (annualSimulation.invoiced_revenue <= 0
        ? 0
        : annualSimulation.variable_social_contributions / annualSimulation.invoiced_revenue)
  );
  const fixedSocialReserve = roundMoney(
    convertAmount(annualSimulation.fixed_social_contributions / 12, annualSimulation.currency, currency, rates)
  );
  const fixedObligationReserve = getMonthlyFrameworkFixedReserve(
    fixedCosts,
    framework,
    monthKey,
    currency,
    rates
  );
  const variableExpenseReserve = getMonthlyVariableExpenseTotal(variableExpenses, currency, rates);
  const excludedPaymentCount = Math.max(0, monthlyPayments.length - monthlyInvoicedPayments.length);

  return {
    key,
    label,
    framework,
    active,
    currency,
    payment_count: monthlyPayments.length,
    invoiced_payment_count: monthlyInvoicedPayments.length,
    excluded_payment_count: excludedPaymentCount,
    gross_charged: grossCharged,
    cash_received: cashReceived,
    invoiced_gross: invoicedGross,
    excluded_gross: roundMoney(grossCharged - invoicedGross),
    studio_fees: studioFees,
    processor_fees: processorFees,
    income_tax_reserve: incomeTaxReserve,
    fixed_social_reserve: fixedSocialReserve,
    variable_social_reserve: variableSocialReserve,
    social_reserve: roundMoney(fixedSocialReserve + variableSocialReserve),
    fixed_obligation_reserve: fixedObligationReserve,
    variable_expense_reserve: variableExpenseReserve,
    estimated_disposable: roundMoney(
      cashReceived - incomeTaxReserve - fixedSocialReserve - variableSocialReserve - fixedObligationReserve - variableExpenseReserve
    ),
    missing_fixed_cost_count: getMissingFixedCostCount(fixedCosts, framework),
    notes,
  };
}

export function getItalyTaxSettings(settings: FinanceSettingsRow): FinanceItalyTaxSettings {
  return {
    label: settings.italy_tax_label || DEFAULT_ITALY_TAX_LABEL,
    is_startup_eligible: settings.italy_is_startup_eligible ?? true,
    startup_tax_rate: clampPercentage(settings.italy_startup_tax_rate ?? DEFAULT_ITALY_STARTUP_TAX_RATE),
    standard_tax_rate: clampPercentage(settings.italy_standard_tax_rate ?? DEFAULT_ITALY_STANDARD_TAX_RATE),
    profitability_coefficient: clampPercentage(
      settings.italy_profitability_coefficient ?? DEFAULT_ITALY_PROFITABILITY_COEFFICIENT
    ),
    inps_regime:
      settings.italy_inps_regime === "commercianti" ? "commercianti" : DEFAULT_ITALY_INPS_REGIME,
    inps_min_taxable_income:
      settings.italy_inps_min_taxable_income ?? DEFAULT_ITALY_INPS_MIN_TAXABLE_INCOME,
    inps_fixed_annual_contribution:
      settings.italy_inps_fixed_annual_contribution ??
      DEFAULT_ITALY_INPS_FIXED_ANNUAL_CONTRIBUTION,
    inps_variable_rate: clampPercentage(
      settings.italy_inps_variable_rate ?? DEFAULT_ITALY_INPS_VARIABLE_RATE
    ),
    apply_forfettario_inps_reduction:
      settings.italy_apply_forfettario_inps_reduction ?? true,
  };
}

export function getSwedenTaxSettings(settings: FinanceSettingsRow): FinanceSwedenTaxSettings {
  return {
    label: settings.sweden_tax_label || DEFAULT_SWEDEN_TAX_LABEL,
    self_employment_contribution_rate: clampPercentage(
      settings.sweden_self_employment_contribution_rate ??
        DEFAULT_SWEDEN_SELF_EMPLOYMENT_CONTRIBUTION_RATE
    ),
    municipal_tax_rate: clampPercentage(
      settings.sweden_municipal_tax_rate ?? DEFAULT_SWEDEN_MUNICIPAL_TAX_RATE
    ),
    state_tax_threshold:
      settings.sweden_state_tax_threshold ?? DEFAULT_SWEDEN_STATE_TAX_THRESHOLD,
    state_tax_rate: clampPercentage(
      settings.sweden_state_tax_rate ?? DEFAULT_SWEDEN_STATE_TAX_RATE
    ),
  };
}

function calculateItalyInpsContribution(
  taxableProfit: number,
  settings: FinanceItalyTaxSettings
): { fixedContribution: number; variableContribution: number; totalContribution: number } {
  const baseContribution = settings.apply_forfettario_inps_reduction
    ? settings.inps_fixed_annual_contribution * 0.65
    : settings.inps_fixed_annual_contribution;
  const excessTaxableIncome = Math.max(0, taxableProfit - settings.inps_min_taxable_income);
  const rawVariableContribution = excessTaxableIncome * (settings.inps_variable_rate / 100);
  const variableContribution = settings.apply_forfettario_inps_reduction
    ? rawVariableContribution * 0.65
    : rawVariableContribution;
  const totalContribution = baseContribution + variableContribution;

  return {
    fixedContribution: roundMoney(baseContribution),
    variableContribution: roundMoney(variableContribution),
    totalContribution: roundMoney(totalContribution),
  };
}

function buildItalyTaxSimulation(
  invoicedPayments: FinancePaymentDerived[],
  settings: FinanceItalyTaxSettings,
  actualFramework: FinanceTaxFramework,
  rates: ResolvedExchangeRates
) {
  const invoicedRevenue = sumGrossPaymentsByCurrency(invoicedPayments, "EUR", rates);
  const taxableProfit = roundMoney(invoicedRevenue * (settings.profitability_coefficient / 100));
  const socialContributions = calculateItalyInpsContribution(taxableProfit, settings);
  const substituteTaxRate = settings.is_startup_eligible
    ? settings.startup_tax_rate
    : settings.standard_tax_rate;
  const incomeTax = roundMoney(
    Math.max(0, taxableProfit - socialContributions.totalContribution) * (substituteTaxRate / 100)
  );
  const netIncome = roundMoney(invoicedRevenue - socialContributions.totalContribution - incomeTax);

  return {
    framework: "italy" as const,
    label: settings.label,
    active: actualFramework === "italy",
    currency: "EUR" as const,
    invoiced_payment_count: invoicedPayments.length,
    invoiced_revenue: invoicedRevenue,
    taxable_profit: taxableProfit,
    fixed_social_contributions: socialContributions.fixedContribution,
    variable_social_contributions: socialContributions.variableContribution,
    social_contributions: socialContributions.totalContribution,
    income_tax: incomeTax,
    net_income: netIncome,
    effective_tax_rate:
      invoicedRevenue > 0
        ? roundMoney(((socialContributions.totalContribution + incomeTax) / invoicedRevenue) * 100)
        : 0,
    notes: [
      `${settings.inps_regime === "commercianti" ? "Commercianti" : "Artigiani"} INPS base`,
      `Forfettario coefficient ${roundMoney(settings.profitability_coefficient)}%`,
      `${settings.is_startup_eligible ? "Startup" : "Standard"} substitute tax ${roundMoney(substituteTaxRate)}%`,
      settings.apply_forfettario_inps_reduction
        ? "Includes 35% INPS reduction on the full contribution due"
        : "No 35% INPS reduction applied",
    ],
  };
}

function buildSwedenTaxSimulation(
  invoicedPayments: FinancePaymentDerived[],
  settings: FinanceSwedenTaxSettings,
  actualFramework: FinanceTaxFramework,
  rates: ResolvedExchangeRates
) {
  const invoicedRevenue = sumGrossPaymentsByCurrency(invoicedPayments, "SEK", rates);
  const socialContributions = roundMoney(
    invoicedRevenue * (settings.self_employment_contribution_rate / 100)
  );
  const taxableProfit = roundMoney(Math.max(0, invoicedRevenue - socialContributions));
  const municipalTax = roundMoney(taxableProfit * (settings.municipal_tax_rate / 100));
  const stateTax = roundMoney(
    Math.max(0, taxableProfit - settings.state_tax_threshold) * (settings.state_tax_rate / 100)
  );
  const incomeTax = roundMoney(municipalTax + stateTax);
  const netIncome = roundMoney(invoicedRevenue - socialContributions - incomeTax);

  return {
    framework: "sweden" as const,
    label: settings.label,
    active: actualFramework === "sweden",
    currency: "SEK" as const,
    invoiced_payment_count: invoicedPayments.length,
    invoiced_revenue: invoicedRevenue,
    taxable_profit: taxableProfit,
    fixed_social_contributions: 0,
    variable_social_contributions: socialContributions,
    social_contributions: socialContributions,
    income_tax: incomeTax,
    net_income: netIncome,
    effective_tax_rate:
      invoicedRevenue > 0
        ? roundMoney(((socialContributions + incomeTax) / invoicedRevenue) * 100)
        : 0,
    notes: [
      `Egenavgifter ${roundMoney(settings.self_employment_contribution_rate)}%`,
      `Municipal tax ${roundMoney(settings.municipal_tax_rate)}%`,
      `State tax ${roundMoney(settings.state_tax_rate)}% above ${roundMoney(settings.state_tax_threshold)} SEK`,
    ],
  };
}

export function buildTaxSummary(
  projects: FinanceProjectWithPayments[],
  settings: FinanceSettingsRow,
  rates: ResolvedExchangeRates,
  monthKey: string
): FinanceTaxSummary {
  const taxYear = Number(monthKey.slice(0, 4));
  const actualFramework = settings.active_tax_framework ?? DEFAULT_ACTIVE_TAX_FRAMEWORK;
  const italySettings = getItalyTaxSettings(settings);
  const swedenSettings = getSwedenTaxSettings(settings);
  const invoicedPayments = getInvoicedPayments(projects, taxYear);

  return {
    tax_year: taxYear,
    tax_base_months: getTaxYearMonths(taxYear),
    actual_framework: actualFramework,
    invoiced_revenue_primary: sumGrossPaymentsByCurrency(
      invoicedPayments,
      settings.reporting_currency_primary,
      rates
    ),
    invoiced_revenue_secondary: sumGrossPaymentsByCurrency(
      invoicedPayments,
      settings.reporting_currency_secondary,
      rates
    ),
    invoiced_revenue_eur: sumGrossPaymentsByCurrency(invoicedPayments, "EUR", rates),
    invoiced_revenue_sek: sumGrossPaymentsByCurrency(invoicedPayments, "SEK", rates),
    invoiced_payment_count: invoicedPayments.length,
    simulations: {
      italy: buildItalyTaxSimulation(invoicedPayments, italySettings, actualFramework, rates),
      sweden: buildSwedenTaxSimulation(invoicedPayments, swedenSettings, actualFramework, rates),
    },
    italy_settings: italySettings,
    sweden_settings: swedenSettings,
  };
}

export function buildFixedCostSummary(
  fixedCosts: FinanceFixedCostRow[],
  primaryCurrency: FinanceCurrency,
  rates: ResolvedExchangeRates,
  monthKey: string
): FinanceFixedCostSummary {
  const currentMonth = Number(monthKey.slice(5, 7));
  const activeCosts = fixedCosts.filter((cost) => cost.is_active);
  const configuredCosts = activeCosts.filter((cost) => cost.annual_amount !== null);

  return {
    annual_total_primary: roundMoney(
      configuredCosts.reduce(
        (total, cost) =>
          total + convertAmount(cost.annual_amount ?? 0, cost.currency, primaryCurrency, rates),
        0
      )
    ),
    annual_total_eur: roundMoney(
      configuredCosts.reduce(
        (total, cost) => total + convertAmount(cost.annual_amount ?? 0, cost.currency, "EUR", rates),
        0
      )
    ),
    configured_count: configuredCosts.length,
    missing_amount_count: activeCosts.filter((cost) => cost.annual_amount === null).length,
    due_soon: activeCosts
      .filter((cost) => cost.due_months.includes(currentMonth))
      .map((cost) => ({
        id: cost.id,
        label: cost.label,
        currency: cost.currency,
        amount: cost.annual_amount,
        due_month: currentMonth,
        cadence: cost.cadence,
        category: cost.category,
        missing_amount: cost.annual_amount === null,
      })),
  };
}

export function buildKeepSummary(
  projects: FinanceProjectWithPayments[],
  settings: FinanceSettingsRow,
  fixedCosts: FinanceFixedCostRow[],
  variableExpenses: FinanceVariableExpenseRow[],
  rates: ResolvedExchangeRates,
  monthKey: string
): FinanceKeepSummary {
  const monthlyPayments = projects
    .flatMap((project) => project.payments)
    .filter((payment) => getPaymentMonthKey(payment.payment_date) === monthKey);
  const monthlyInvoicedPayments = getMonthlyInvoicedPayments(projects, monthKey);
  const monthlyVariableExpenses = getMonthlyVariableExpenses(variableExpenses, monthKey);
  const taxSummary = buildTaxSummary(projects, settings, rates, monthKey);
  const primaryCurrency = settings.reporting_currency_primary;
  const italyScenarioCurrency: FinanceCurrency = "EUR";
  const swedenScenarioCurrency: FinanceCurrency = "SEK";
  const currentItalySimulation = taxSummary.simulations.italy;
  const italyStandardSimulation = buildItalyTaxSimulation(
    getInvoicedPayments(projects, taxSummary.tax_year),
    {
      ...taxSummary.italy_settings,
      is_startup_eligible: false,
      label: `${taxSummary.italy_settings.label} after 5% period`,
    },
    taxSummary.actual_framework,
    rates
  );
  const swedenSimulation = taxSummary.simulations.sweden;
  const activeCashflow = buildKeepScenario(
    taxSummary.actual_framework === "sweden" ? "sweden" : "italy_current",
    taxSummary.actual_framework === "sweden"
      ? swedenSimulation.label
      : "Current month cashflow",
    taxSummary.actual_framework,
    true,
    monthlyPayments,
    monthlyInvoicedPayments,
    taxSummary.actual_framework === "sweden" ? swedenSimulation : currentItalySimulation,
    fixedCosts,
    monthlyVariableExpenses,
    monthKey,
    primaryCurrency,
    rates,
    [
      "Cash received uses all monthly payments after studio split and payment fees",
      "Income tax reserve only applies to payments marked invoice done",
    ]
  );
  const excludedGrossTotal = roundMoney(
    monthlyPayments.reduce((total, payment) => {
      if (payment.invoice_done) return total;
      return total + convertAmount(payment.gross_amount, payment.currency, primaryCurrency, rates);
    }, 0)
  );

  return {
    month: monthKey,
    currency: primaryCurrency,
    payment_count: monthlyPayments.length,
    invoiced_payment_count: monthlyInvoicedPayments.length,
    excluded_payment_count: Math.max(0, monthlyPayments.length - monthlyInvoicedPayments.length),
    excluded_gross_total: excludedGrossTotal,
    active_cashflow: activeCashflow,
    scenarios: {
      italy_current: buildKeepScenario(
        "italy_current",
        currentItalySimulation.label,
        "italy",
        taxSummary.actual_framework === "italy",
        monthlyPayments,
        monthlyInvoicedPayments,
        currentItalySimulation,
        fixedCosts,
        monthlyVariableExpenses,
        monthKey,
        italyScenarioCurrency,
        rates,
        [
          `Reserve rate derived from yearly ${currentItalySimulation.label} simulation`,
          "Taxes are still based on invoiced gross, even if studio and card fees reduce real cash kept",
        ]
      ),
      italy_standard: buildKeepScenario(
        "italy_standard",
        italyStandardSimulation.label,
        "italy",
        false,
        monthlyPayments,
        monthlyInvoicedPayments,
        italyStandardSimulation,
        fixedCosts,
        monthlyVariableExpenses,
        monthKey,
        italyScenarioCurrency,
        rates,
        [
          "Same invoiced work, but with the standard Italy substitute-tax rate instead of the startup rate",
        ]
      ),
      sweden: buildKeepScenario(
        "sweden",
        swedenSimulation.label,
        "sweden",
        taxSummary.actual_framework === "sweden",
        monthlyPayments,
        monthlyInvoicedPayments,
        swedenSimulation,
        fixedCosts,
        monthlyVariableExpenses,
        monthKey,
        swedenScenarioCurrency,
        rates,
        [
          "First Sweden comparison based on a sole-trader style setup",
          "Will improve later once variable deductible expenses are part of the model",
        ]
      ),
    },
  };
}

export function buildVariableExpenseSummary(
  expenses: FinanceVariableExpenseRow[],
  primaryCurrency: FinanceCurrency,
  rates: ResolvedExchangeRates,
  monthKey: string
): FinanceVariableExpenseSummary {
  const monthlyExpenses = getMonthlyVariableExpenses(expenses, monthKey);
  const categoryMap = new Map<string, { total_primary: number; entry_count: number }>();

  for (const expense of monthlyExpenses) {
    const current = categoryMap.get(expense.category) ?? { total_primary: 0, entry_count: 0 };
    current.total_primary = roundMoney(
      current.total_primary + convertAmount(expense.amount, expense.currency, primaryCurrency, rates)
    );
    current.entry_count += 1;
    categoryMap.set(expense.category, current);
  }

  return {
    month_total_primary: getMonthlyVariableExpenseTotal(monthlyExpenses, primaryCurrency, rates),
    month_total_eur: getMonthlyVariableExpenseTotal(monthlyExpenses, "EUR", rates),
    entry_count: monthlyExpenses.length,
    by_category: [...categoryMap.entries()].map(([category, totals]) => ({
      category: category as FinanceVariableExpenseSummary["by_category"][number]["category"],
      total_primary: totals.total_primary,
      entry_count: totals.entry_count,
    })),
  };
}

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
  const studio_fee_base_reporting =
    payment.studio_fee_base_amount !== null && payment.studio_fee_base_currency !== null
      ? rates
        ? convertAmount(
            payment.studio_fee_base_amount,
            payment.studio_fee_base_currency,
            payment.reporting_currency,
            rates
          )
        : payment.studio_fee_base_amount
      : gross_amount_reporting;
  const fee_amount = calculateFeeAmount(studio_fee_base_reporting, payment.fee_percentage);
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
        open_invoice_count: 0,
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
      if (payment.invoice_needed && !payment.invoice_done) current.open_invoice_count += 1;

      monthMap.set(month, current);
    }
  }

  return [...monthMap.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-monthsToInclude);
}

export function buildMonthlyContextPayouts(
  projects: FinanceProjectWithPayments[],
  monthsToInclude = 6
): FinanceMonthlyContextPayout[] {
  const payoutMap = new Map<string, FinanceMonthlyContextPayout>();

  for (const project of projects) {
    for (const payment of project.payments) {
      const month = getPaymentMonthKey(payment.payment_date);
      const key = `${month}:${project.work_context}:${payment.reporting_currency}`;
      const current = payoutMap.get(key) ?? {
        month,
        label: formatTrendMonth(month),
        work_context: project.work_context,
        reporting_currency: payment.reporting_currency,
        fee_total: 0,
        processor_fee_total: 0,
        entry_count: 0,
      };

      current.fee_total = roundMoney(current.fee_total + payment.fee_amount);
      current.processor_fee_total = roundMoney(
        current.processor_fee_total + payment.processor_fee_amount_reporting
      );
      current.entry_count += 1;

      payoutMap.set(key, current);
    }
  }

  return [...payoutMap.values()]
    .sort((a, b) => {
      if (a.month !== b.month) return a.month.localeCompare(b.month);
      if (a.work_context !== b.work_context) {
        return a.work_context.localeCompare(b.work_context);
      }
      return a.reporting_currency.localeCompare(b.reporting_currency);
    })
    .slice(-monthsToInclude * 4);
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
