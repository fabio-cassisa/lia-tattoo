import type {
  FinanceContextSettingsRow,
  FinanceCurrency,
  FinanceFixedCostCadence,
  FinanceFixedCostCategory,
  FinanceItalyInpsRegime,
  FinancePaymentMethod,
  FinanceTaxFramework,
  FinanceVariableExpenseCategory,
  FinanceWorkContext,
} from "@/lib/supabase/database.types";

export const FINANCE_CONTEXT_LABELS: Record<FinanceWorkContext, string> = {
  malmo_studio: "Malmö / Diamant studio",
  copenhagen_studio: "Copenhagen / Good Morning Tattoo studio",
  private_home: "Friuli / by appointment",
  torino_studio: "Turin / Studio Etra",
  guest_spot: "Touring / guest spots",
};

const LEGACY_FINANCE_CONTEXT_LABELS: Partial<Record<FinanceWorkContext, string[]>> = {
  malmo_studio: ["Malmö studio"],
  copenhagen_studio: ["Copenhagen studio", "Copenhagen guest spot"],
  private_home: ["Private / home"],
  guest_spot: ["Guest spot"],
};

export const FINANCE_CONTEXT_CURRENCY_DEFAULTS: Record<
  FinanceWorkContext,
  FinanceCurrency
> = {
  malmo_studio: "SEK",
  copenhagen_studio: "DKK",
  private_home: "EUR",
  torino_studio: "EUR",
  guest_spot: "EUR",
};

export const FINANCE_CONTEXT_FEE_DEFAULTS: Record<
  FinanceWorkContext,
  number
> = {
  malmo_studio: 30,
  copenhagen_studio: 30,
  private_home: 0,
  torino_studio: 40,
  guest_spot: 40,
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
  "private_home",
  "torino_studio",
  "guest_spot",
];

export const FINANCE_WORK_CONTEXT_SORT_ORDER: Record<FinanceWorkContext, number> = {
  malmo_studio: 0,
  copenhagen_studio: 1,
  private_home: 2,
  torino_studio: 3,
  guest_spot: 4,
};

export const CARD_INVOICE_PAYMENT_METHODS: FinancePaymentMethod[] = ["card"];
export const DEFAULT_CARD_PROCESSOR_FEE_PERCENTAGE = 1.95;
export const FINANCE_TAX_FRAMEWORK_OPTIONS: FinanceTaxFramework[] = ["italy", "sweden"];
export const FINANCE_ITALY_INPS_REGIME_OPTIONS: FinanceItalyInpsRegime[] = [
  "artigiani",
  "commercianti",
];

export const FINANCE_TAX_FRAMEWORK_LABELS: Record<FinanceTaxFramework, string> = {
  italy: "Italy",
  sweden: "Sweden",
};

export const FINANCE_ITALY_INPS_REGIME_LABELS: Record<FinanceItalyInpsRegime, string> = {
  artigiani: "Artigiani",
  commercianti: "Commercianti",
};

export const DEFAULT_ACTIVE_TAX_FRAMEWORK: FinanceTaxFramework = "italy";
export const DEFAULT_ITALY_TAX_LABEL = "Italy actual setup";
export const DEFAULT_ITALY_STARTUP_TAX_RATE = 5;
export const DEFAULT_ITALY_STANDARD_TAX_RATE = 15;
export const DEFAULT_ITALY_PROFITABILITY_COEFFICIENT = 67;
export const DEFAULT_ITALY_INPS_REGIME: FinanceItalyInpsRegime = "artigiani";
export const DEFAULT_ITALY_INPS_MIN_TAXABLE_INCOME = 18555;
export const DEFAULT_ITALY_ACTUAL_INPS_FIXED_ANNUAL_CONTRIBUTION = 2902.08;
export const DEFAULT_ITALY_INPS_FIXED_ANNUAL_CONTRIBUTION =
  DEFAULT_ITALY_ACTUAL_INPS_FIXED_ANNUAL_CONTRIBUTION;
export const DEFAULT_ITALY_INPS_VARIABLE_RATE = 24;
export const DEFAULT_SWEDEN_TAX_LABEL = "Sweden comparison setup";
export const DEFAULT_SWEDEN_SELF_EMPLOYMENT_CONTRIBUTION_RATE = 28.97;
export const DEFAULT_SWEDEN_MUNICIPAL_TAX_RATE = 32.41;
export const DEFAULT_SWEDEN_STATE_TAX_THRESHOLD = 625800;
export const DEFAULT_SWEDEN_STATE_TAX_RATE = 20;

export const FINANCE_FIXED_COST_CATEGORY_LABELS: Record<FinanceFixedCostCategory, string> = {
  statutory: "Statutory",
  software: "Software",
  professional: "Professional",
  insurance: "Insurance",
  other: "Other",
};

export const FINANCE_FIXED_COST_CADENCE_LABELS: Record<FinanceFixedCostCadence, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export const FINANCE_FIXED_COST_CATEGORY_OPTIONS: FinanceFixedCostCategory[] = [
  "statutory",
  "software",
  "professional",
  "insurance",
  "other",
];

export const FINANCE_FIXED_COST_CADENCE_OPTIONS: FinanceFixedCostCadence[] = [
  "monthly",
  "quarterly",
  "annual",
];

export const FINANCE_VARIABLE_EXPENSE_CATEGORY_LABELS: Record<
  FinanceVariableExpenseCategory,
  string
> = {
  needles: "Needles",
  ink: "Ink",
  supplies: "Supplies",
  equipment: "Equipment",
  travel: "Travel",
  other: "Other",
};

export const FINANCE_VARIABLE_EXPENSE_CATEGORY_OPTIONS: FinanceVariableExpenseCategory[] = [
  "needles",
  "ink",
  "supplies",
  "equipment",
  "travel",
  "other",
];

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
  const savedLabel = contextSettings?.find((item) => item.context === context)?.label;
  const normalizedSavedLabel = normalizeContextLabel(context, savedLabel);

  if (normalizedSavedLabel) {
    return normalizedSavedLabel;
  }

  return FINANCE_CONTEXT_LABELS[context];
}

export function getFinanceWorkContextSortOrder(context: FinanceWorkContext): number {
  return FINANCE_WORK_CONTEXT_SORT_ORDER[context] ?? Number.MAX_SAFE_INTEGER;
}

export function normalizeContextLabel(
  context: FinanceWorkContext,
  label: string | null | undefined
): string | null {
  if (typeof label !== "string") return null;

  const trimmed = label.trim();
  if (!trimmed) return null;

  if (LEGACY_FINANCE_CONTEXT_LABELS[context]?.includes(trimmed)) {
    return FINANCE_CONTEXT_LABELS[context];
  }

  return (
    trimmed
  );
}
