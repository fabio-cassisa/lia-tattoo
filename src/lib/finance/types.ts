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
  fee_amount: number;
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
  currency: FinanceCurrency;
  fee_total: number;
  gross_total: number;
  net_total: number;
  entry_count: number;
};

export type FinanceDashboardSummary = {
  month: string;
  entry_count: number;
  open_invoice_count: number;
  net_totals: Record<FinanceCurrency, number>;
  fee_totals: Record<FinanceCurrency, number>;
  fee_totals_by_context: FinanceContextFeeSummary[];
  approx_primary: FinanceApproxTotal;
  approx_secondary: FinanceApproxTotal;
  comparison: FinanceComparison;
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
