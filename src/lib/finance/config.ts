import type {
  FinanceContextSettingsRow,
  FinanceCurrency,
  FinancePaymentMethod,
  FinanceWorkContext,
} from "@/lib/supabase/database.types";

export const FINANCE_CONTEXT_LABELS: Record<FinanceWorkContext, string> = {
  malmo_studio: "Malmö studio",
  copenhagen_studio: "Copenhagen studio",
  guest_spot: "Guest spot",
  private_home: "Private / home",
};

export const FINANCE_CONTEXT_CURRENCY_DEFAULTS: Record<
  FinanceWorkContext,
  FinanceCurrency
> = {
  malmo_studio: "SEK",
  copenhagen_studio: "DKK",
  guest_spot: "EUR",
  private_home: "EUR",
};

export const FINANCE_CONTEXT_FEE_DEFAULTS: Record<
  FinanceWorkContext,
  number
> = {
  malmo_studio: 30,
  copenhagen_studio: 30,
  guest_spot: 40,
  private_home: 0,
};

export const FINANCE_PAYMENT_METHOD_LABELS: Record<
  FinancePaymentMethod,
  string
> = {
  cash: "Cash",
  card: "Card / SumUp",
  bank_transfer: "Bank transfer",
  paypal: "PayPal",
  revolut: "Revolut",
  swish: "Swish",
};

export const FINANCE_CURRENCY_OPTIONS: FinanceCurrency[] = ["SEK", "DKK", "EUR"];

export const FINANCE_PAYMENT_METHOD_OPTIONS: FinancePaymentMethod[] = [
  "cash",
  "card",
  "bank_transfer",
  "paypal",
  "revolut",
  "swish",
];

export const FINANCE_WORK_CONTEXT_OPTIONS: FinanceWorkContext[] = [
  "malmo_studio",
  "copenhagen_studio",
  "guest_spot",
  "private_home",
];

export const CARD_INVOICE_PAYMENT_METHODS: FinancePaymentMethod[] = ["card"];
export const DEFAULT_CARD_PROCESSOR_FEE_PERCENTAGE = 1.95;

export function paymentMethodNeedsInvoiceByDefault(
  method: FinancePaymentMethod
): boolean {
  return CARD_INVOICE_PAYMENT_METHODS.includes(method);
}

export function calculateFeeAmount(
  grossAmount: number,
  feePercentage: number
): number {
  return Math.round(grossAmount * (feePercentage / 100) * 100) / 100;
}

export function calculateProcessorFeeAmount(
  grossAmount: number,
  processorFeePercentage: number
): number {
  return Math.round(grossAmount * (processorFeePercentage / 100) * 100) / 100;
}

export function calculateNetAmount(
  grossAmount: number,
  feePercentage: number,
  processorFeePercentage = 0
): number {
  return Math.round(
    (grossAmount -
      calculateFeeAmount(grossAmount, feePercentage) -
      calculateProcessorFeeAmount(grossAmount, processorFeePercentage)) *
      100
  ) / 100;
}

export function getContextCurrencyDefault(
  context: FinanceWorkContext,
  contextSettings?: FinanceContextSettingsRow[]
): FinanceCurrency {
  return (
    contextSettings?.find((item) => item.context === context)?.default_currency ??
    FINANCE_CONTEXT_CURRENCY_DEFAULTS[context]
  );
}

export function getContextFeeDefault(
  context: FinanceWorkContext,
  contextSettings?: FinanceContextSettingsRow[]
): number {
  return (
    contextSettings?.find((item) => item.context === context)?.default_fee_percentage ??
    FINANCE_CONTEXT_FEE_DEFAULTS[context]
  );
}

export function getContextLabel(
  context: FinanceWorkContext,
  contextSettings?: FinanceContextSettingsRow[]
): string {
  return (
    contextSettings?.find((item) => item.context === context)?.label ??
    FINANCE_CONTEXT_LABELS[context]
  );
}
