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
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
