import type {
  BookingLocation,
  BookingStatus,
  BookingType,
  FinanceContextSettingsRow,
  FinanceCurrency,
  FinanceFixedCostCategory,
  FinanceFixedCostCadence,
  FinanceFixedCostRow,
  FinanceItalyInpsRegime,
  FinancePaymentRow,
  FinanceSettingsRow,
  FinanceProjectRow,
  FinanceTaxFramework,
  FinanceVariableExpenseCategory,
  FinanceVariableExpenseRow,
  FinanceWorkContext,
} from "@/lib/supabase/database.types";

export type FinanceBookingOption = {
  id: string;
  client_name: string;
  location: BookingLocation;
  type: BookingType;
  status: BookingStatus;
  deposit_amount: number | null;
  appointment_date: string | null;
  preferred_dates: string | null;
  is_linked: boolean;
};

export type FinancePaymentDerived = FinancePaymentRow & {
  gross_amount_reporting: number;
  fee_amount: number;
  processor_fee_currency: FinanceCurrency;
  processor_fee_amount: number;
  processor_fee_amount_reporting: number;
  net_amount: number;
};

export type FinanceProjectWithPayments = FinanceProjectRow & {
  payments: FinancePaymentDerived[];
};

export type FinanceInvoiceReminder = FinancePaymentDerived & {
  project_id: string;
  project_label: string;
  client_name: string;
  work_context: FinanceProjectRow["work_context"];
};

export type FinanceApproxTotal = {
  currency: FinanceCurrency;
  amount: number;
  source: "live" | "fallback";
};

export type FinanceComparison = {
  previous_month: string;
  amount_delta: number;
  percent_delta: number | null;
};

export type FinanceContextFeeSummary = {
  work_context: FinanceWorkContext;
  reporting_currency: FinanceCurrency;
  fee_total: number;
  processor_fee_total: number;
  gross_total: number;
  net_total: number;
  entry_count: number;
};

export type FinanceWeeklySummary = {
  week_key: string;
  label: string;
  month_entry_count: number;
  net_total: number;
  studio_fee_total: number;
  processor_fee_total: number;
};

export type FinanceMonthlyTrendPoint = {
  month: string;
  label: string;
  net_total: number;
  studio_fee_total: number;
  processor_fee_total: number;
  open_invoice_count: number;
};

export type FinanceMonthlyContextPayout = {
  month: string;
  label: string;
  work_context: FinanceWorkContext;
  reporting_currency: FinanceCurrency;
  fee_total: number;
  processor_fee_total: number;
  entry_count: number;
};

export type FinanceTaxSimulationInput = {
  framework: FinanceTaxFramework;
  label: string;
  active: boolean;
  currency: FinanceCurrency;
  invoiced_payment_count: number;
  invoiced_revenue: number;
  taxable_profit: number;
  social_contributions: number;
  income_tax: number;
  net_income: number;
  effective_tax_rate: number;
  notes: string[];
};

export type FinanceItalyTaxSettings = {
  label: string;
  is_startup_eligible: boolean;
  startup_tax_rate: number;
  standard_tax_rate: number;
  profitability_coefficient: number;
  inps_regime: FinanceItalyInpsRegime;
  inps_min_taxable_income: number;
  inps_fixed_annual_contribution: number;
  inps_variable_rate: number;
  apply_forfettario_inps_reduction: boolean;
};

export type FinanceSwedenTaxSettings = {
  label: string;
  self_employment_contribution_rate: number;
  municipal_tax_rate: number;
  state_tax_threshold: number;
  state_tax_rate: number;
};

export type FinanceFixedCostDraft = FinanceFixedCostRow;

export type FinanceFixedCostSummary = {
  annual_total_primary: number;
  annual_total_eur: number;
  configured_count: number;
  missing_amount_count: number;
  due_soon: Array<{
    id: string;
    label: string;
    currency: FinanceCurrency;
    amount: number | null;
    due_month: number;
    cadence: FinanceFixedCostCadence;
    category: FinanceFixedCostCategory;
    missing_amount: boolean;
  }>;
};

export type FinanceKeepScenarioKey = "italy_current" | "italy_standard" | "sweden";

export type FinanceKeepScenarioSummary = {
  key: FinanceKeepScenarioKey;
  label: string;
  framework: FinanceTaxFramework;
  active: boolean;
  currency: FinanceCurrency;
  invoiced_payment_count: number;
  invoiced_gross: number;
  studio_fees: number;
  processor_fees: number;
  tax_reserve: number;
  fixed_cost_reserve: number;
  variable_expense_reserve: number;
  estimated_keep: number;
  reserve_rate: number;
  missing_fixed_cost_count: number;
  notes: string[];
};

export type FinanceKeepSummary = {
  month: string;
  currency: FinanceCurrency;
  invoiced_payment_count: number;
  excluded_payment_count: number;
  variable_expense_total: number;
  scenarios: {
    italy_current: FinanceKeepScenarioSummary;
    italy_standard: FinanceKeepScenarioSummary;
    sweden: FinanceKeepScenarioSummary;
  };
};

export type FinanceVariableExpenseSummary = {
  month_total_primary: number;
  month_total_eur: number;
  entry_count: number;
  by_category: Array<{
    category: FinanceVariableExpenseCategory;
    total_primary: number;
    entry_count: number;
  }>;
};

export type FinanceTaxSummary = {
  tax_year: number;
  tax_base_months: string[];
  actual_framework: FinanceTaxFramework;
  invoiced_revenue_primary: number;
  invoiced_revenue_secondary: number;
  invoiced_revenue_eur: number;
  invoiced_revenue_sek: number;
  invoiced_payment_count: number;
  simulations: {
    italy: FinanceTaxSimulationInput;
    sweden: FinanceTaxSimulationInput;
  };
  italy_settings: FinanceItalyTaxSettings;
  sweden_settings: FinanceSwedenTaxSettings;
};

export type FinanceDashboardSummary = {
  month: string;
  entry_count: number;
  month_total: number;
  week_total: number;
  open_invoice_count: number;
  net_totals_by_reporting_currency: Record<FinanceCurrency, number>;
  studio_fee_totals_by_reporting_currency: Record<FinanceCurrency, number>;
  processor_fee_totals_by_processor_currency: Record<FinanceCurrency, number>;
  processor_fee_approx_totals_by_reporting_currency: Record<FinanceCurrency, number>;
  fee_totals_by_context: FinanceContextFeeSummary[];
  approx_primary: FinanceApproxTotal;
  approx_secondary: FinanceApproxTotal;
  comparison: FinanceComparison;
  weekly: FinanceWeeklySummary[];
  monthly_trend: FinanceMonthlyTrendPoint[];
  monthly_context_payouts: FinanceMonthlyContextPayout[];
  fixed_costs: FinanceFixedCostSummary;
  variable_expenses: FinanceVariableExpenseSummary;
  keep_summary: FinanceKeepSummary;
  tax_summary: FinanceTaxSummary;
};

export type FinanceDashboardResponse = {
  month: string;
  summary: FinanceDashboardSummary;
  context_settings: FinanceContextSettingsRow[];
  settings: FinanceSettingsRow;
  fixed_costs: FinanceFixedCostRow[];
  variable_expenses: FinanceVariableExpenseRow[];
  bookings: FinanceBookingOption[];
  projects: FinanceProjectWithPayments[];
  invoice_reminders: FinanceInvoiceReminder[];
};

export type FinanceSettingsResponse = {
  context_settings: FinanceContextSettingsRow[];
  settings: FinanceSettingsRow;
  fixed_costs: FinanceFixedCostRow[];
};
