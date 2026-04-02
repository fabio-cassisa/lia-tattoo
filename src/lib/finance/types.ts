import type {
  BookingLocation,
  BookingStatus,
  BookingType,
  FinanceContextSettingsRow,
  FinanceCurrency,
  FinancePaymentRow,
  FinanceSettingsRow,
  FinanceProjectRow,
  FinanceWorkContext,
} from "@/lib/supabase/database.types";

export type FinanceBookingOption = {
  id: string;
  client_name: string;
  location: BookingLocation;
  type: BookingType;
  status: BookingStatus;
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
};

export type FinanceDashboardResponse = {
  month: string;
  summary: FinanceDashboardSummary;
  context_settings: FinanceContextSettingsRow[];
  settings: FinanceSettingsRow;
  bookings: FinanceBookingOption[];
  projects: FinanceProjectWithPayments[];
  invoice_reminders: FinanceInvoiceReminder[];
};

export type FinanceSettingsResponse = {
  context_settings: FinanceContextSettingsRow[];
  settings: FinanceSettingsRow;
};
