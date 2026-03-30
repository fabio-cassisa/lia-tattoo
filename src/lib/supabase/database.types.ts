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
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
