import type {
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
  copenhagen_studio: 40,
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

export const CARD_INVOICE_PAYMENT_METHODS: FinancePaymentMethod[] = ["card"];

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

export function calculateNetAmount(
  grossAmount: number,
  feePercentage: number
): number {
  return Math.round((grossAmount - calculateFeeAmount(grossAmount, feePercentage)) * 100) / 100;
}
