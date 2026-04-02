/**
 * Database type definitions for Supabase.
 *
 * Once the Supabase project is live, you can auto-generate these with:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/database.types.ts
 *
 * For now, hand-written to match our schema.
 */

export type BookingStatus =
  | "pending"
  | "approved"
  | "declined"
  | "deposit_paid"
  | "completed"
  | "cancelled";

export type BookingType =
  | "flash"
  | "custom"
  | "consultation"
  | "coverup"
  | "rework";

export type BookingSize = "small" | "medium" | "large" | "xlarge";

export type ColorPreference = "blackgrey" | "color" | "both";

export type BookingLocation = "malmo" | "copenhagen";

export type FinanceCurrency = "SEK" | "DKK" | "EUR";

export type FinancePaymentMethod =
  | "cash"
  | "card"
  | "bank_transfer"
  | "paypal"
  | "revolut"
  | "swish";

export type FinanceWorkContext =
  | "malmo_studio"
  | "copenhagen_studio"
  | "guest_spot"
  | "private_home";

export type FinanceTaxFramework = "italy" | "sweden";

export type FinanceItalyInpsRegime = "artigiani" | "commercianti";

export type BookingRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: BookingStatus;
  location: BookingLocation;
  type: BookingType;
  description: string;
  placement: string;
  size: BookingSize;
  color: ColorPreference;
  allergies: string | null;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  admin_notes: string | null;
  deposit_amount: number | null;
  appointment_date: string | null;
  appointment_end: string | null;
  calendar_event_id: string | null;
  preferred_dates: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
};

export type BookingInsert = {
  location: BookingLocation;
  type: BookingType;
  description: string;
  placement: string;
  size: BookingSize;
  color: ColorPreference;
  allergies?: string | null;
  client_name: string;
  client_email: string;
  client_phone?: string | null;
  deposit_amount?: number | null;
  appointment_date?: string | null;
  appointment_end?: string | null;
  preferred_dates?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
};

export type BookingImageRow = {
  id: string;
  created_at: string;
  booking_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
};

export type PortfolioCategory = "flash" | "completed";

export type PortfolioImageRow = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string | null;
  category: PortfolioCategory;
  storage_path: string;
  display_order: number;
  is_visible: boolean;
  width: number | null;
  height: number | null;
};

export type PortfolioImageInsert = {
  title?: string | null;
  category: PortfolioCategory;
  storage_path: string;
  display_order?: number;
  is_visible?: boolean;
  width?: number | null;
  height?: number | null;
};

// ── Instagram cache types ────────────────────────────────

export type InstagramMediaCacheRow = {
  id: string;
  instagram_id: string;
  media_type: string;
  caption: string | null;
  permalink: string;
  media_url: string;
  thumbnail_url: string | null;
  timestamp: string;
  like_count: number;
  comments_count: number;
  impressions: number | null;
  reach: number | null;
  engagement: number | null;
  saved: number | null;
  shares: number | null;
  fetched_at: string;
};

export type InstagramTokenRow = {
  id: string;
  access_token: string;
  token_type: string;
  expires_at: string;
  instagram_user_id: string;
  updated_at: string;
};

export type FinanceContextSettingsRow = {
  context: FinanceWorkContext;
  created_at: string;
  updated_at: string;
  label: string;
  default_currency: FinanceCurrency;
  default_fee_percentage: number;
  sort_order: number;
  is_active: boolean;
};

export type FinanceContextSettingsInsert = {
  context: FinanceWorkContext;
  label: string;
  default_currency: FinanceCurrency;
  default_fee_percentage?: number;
  sort_order?: number;
  is_active?: boolean;
};

export type FinanceSettingsRow = {
  scope: "default";
  created_at: string;
  updated_at: string;
  reporting_currency_primary: FinanceCurrency;
  reporting_currency_secondary: FinanceCurrency;
  use_live_exchange_rates: boolean;
  fallback_sek_to_eur: number | null;
  fallback_dkk_to_eur: number | null;
  fallback_eur_to_sek: number | null;
  card_invoice_default: boolean;
  card_processor_fee_percentage: number;
  active_tax_framework: FinanceTaxFramework;
  italy_tax_label: string;
  italy_is_startup_eligible: boolean;
  italy_startup_tax_rate: number;
  italy_standard_tax_rate: number;
  italy_profitability_coefficient: number;
  italy_inps_regime: FinanceItalyInpsRegime;
  italy_inps_min_taxable_income: number;
  italy_inps_fixed_annual_contribution: number;
  italy_inps_variable_rate: number;
  italy_apply_forfettario_inps_reduction: boolean;
  sweden_tax_label: string;
  sweden_self_employment_contribution_rate: number;
  sweden_municipal_tax_rate: number;
  sweden_state_tax_threshold: number;
  sweden_state_tax_rate: number;
  sweden_preview_label: string;
  sweden_preview_rate: number;
  sweden_preview_fixed_monthly_cost: number;
};

export type FinanceSettingsInsert = {
  scope?: "default";
  reporting_currency_primary?: FinanceCurrency;
  reporting_currency_secondary?: FinanceCurrency;
  use_live_exchange_rates?: boolean;
  fallback_sek_to_eur?: number | null;
  fallback_dkk_to_eur?: number | null;
  fallback_eur_to_sek?: number | null;
  card_invoice_default?: boolean;
  card_processor_fee_percentage?: number;
  active_tax_framework?: FinanceTaxFramework;
  italy_tax_label?: string;
  italy_is_startup_eligible?: boolean;
  italy_startup_tax_rate?: number;
  italy_standard_tax_rate?: number;
  italy_profitability_coefficient?: number;
  italy_inps_regime?: FinanceItalyInpsRegime;
  italy_inps_min_taxable_income?: number;
  italy_inps_fixed_annual_contribution?: number;
  italy_inps_variable_rate?: number;
  italy_apply_forfettario_inps_reduction?: boolean;
  sweden_tax_label?: string;
  sweden_self_employment_contribution_rate?: number;
  sweden_municipal_tax_rate?: number;
  sweden_state_tax_threshold?: number;
  sweden_state_tax_rate?: number;
  sweden_preview_label?: string;
  sweden_preview_rate?: number;
  sweden_preview_fixed_monthly_cost?: number;
};

export type FinanceProjectRow = {
  id: string;
  created_at: string;
  updated_at: string;
  booking_id: string | null;
  client_name: string;
  project_label: string;
  session_date: string | null;
  work_context: FinanceWorkContext;
  context_label: string | null;
  notes: string | null;
};

export type FinanceProjectInsert = {
  booking_id?: string | null;
  client_name: string;
  project_label: string;
  session_date?: string | null;
  work_context: FinanceWorkContext;
  context_label?: string | null;
  notes?: string | null;
};

export type FinancePaymentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  payment_label: string;
  payment_date: string;
  gross_amount: number;
  currency: FinanceCurrency;
  reporting_currency: FinanceCurrency;
  payment_method: FinancePaymentMethod;
  fee_percentage: number;
  processor_fee_percentage: number;
  invoice_needed: boolean;
  invoice_done: boolean;
  invoice_last_nudged_at: string | null;
  invoice_reminder_note: string | null;
  invoice_reference: string | null;
  notes: string | null;
};

export type FinancePaymentInsert = {
  project_id: string;
  payment_label?: string;
  payment_date: string;
  gross_amount: number;
  currency: FinanceCurrency;
  reporting_currency: FinanceCurrency;
  payment_method: FinancePaymentMethod;
  fee_percentage?: number;
  processor_fee_percentage?: number;
  invoice_needed?: boolean;
  invoice_done?: boolean;
  invoice_last_nudged_at?: string | null;
  invoice_reminder_note?: string | null;
  invoice_reference?: string | null;
  notes?: string | null;
};

export type Database = {
  public: {
    Tables: {
      bookings: {
        Row: BookingRow;
        Insert: BookingInsert;
        Update: Partial<BookingRow>;
        Relationships: [];
      };
      booking_images: {
        Row: BookingImageRow;
        Insert: Omit<BookingImageRow, "id" | "created_at">;
        Update: Partial<BookingImageRow>;
        Relationships: [];
      };
      portfolio_images: {
        Row: PortfolioImageRow;
        Insert: PortfolioImageInsert;
        Update: Partial<PortfolioImageRow>;
        Relationships: [];
      };
      instagram_media_cache: {
        Row: InstagramMediaCacheRow;
        Insert: Omit<InstagramMediaCacheRow, "id" | "fetched_at">;
        Update: Partial<InstagramMediaCacheRow>;
        Relationships: [];
      };
      instagram_tokens: {
        Row: InstagramTokenRow;
        Insert: Omit<InstagramTokenRow, "id" | "updated_at">;
        Update: Partial<InstagramTokenRow>;
        Relationships: [];
      };
      finance_context_settings: {
        Row: FinanceContextSettingsRow;
        Insert: FinanceContextSettingsInsert;
        Update: Partial<FinanceContextSettingsRow>;
        Relationships: [];
      };
      finance_settings: {
        Row: FinanceSettingsRow;
        Insert: FinanceSettingsInsert;
        Update: Partial<FinanceSettingsRow>;
        Relationships: [];
      };
      finance_projects: {
        Row: FinanceProjectRow;
        Insert: FinanceProjectInsert;
        Update: Partial<FinanceProjectRow>;
        Relationships: [];
      };
      finance_payments: {
        Row: FinancePaymentRow;
        Insert: FinancePaymentInsert;
        Update: Partial<FinancePaymentRow>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      booking_status: BookingStatus;
      booking_type: BookingType;
      booking_size: BookingSize;
      color_preference: ColorPreference;
      booking_location: BookingLocation;
      portfolio_category: PortfolioCategory;
      finance_currency: FinanceCurrency;
      finance_payment_method: FinancePaymentMethod;
      finance_work_context: FinanceWorkContext;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
