-- ============================================
-- Lia Tattoo — Initial Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================

-- Custom enum types
CREATE TYPE booking_status AS ENUM (
  'pending',
  'approved',
  'declined',
  'deposit_paid',
  'completed',
  'cancelled'
);

CREATE TYPE booking_type AS ENUM (
  'flash',
  'custom',
  'consultation',
  'coverup',
  'rework'
);

CREATE TYPE booking_size AS ENUM (
  'small',
  'medium',
  'large',
  'xlarge'
);

CREATE TYPE color_preference AS ENUM (
  'blackgrey',
  'color',
  'both'
);

CREATE TYPE booking_location AS ENUM (
  'malmo',
  'copenhagen'
);

-- ============================================
-- Bookings table
-- ============================================
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  status booking_status DEFAULT 'pending' NOT NULL,

  -- Location
  location booking_location NOT NULL,

  -- Request details
  type booking_type NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  placement TEXT NOT NULL DEFAULT '',
  size booking_size NOT NULL,
  color color_preference NOT NULL,
  allergies TEXT,

  -- Contact info
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,

  -- Admin fields (filled by Lia)
  admin_notes TEXT,
  deposit_amount NUMERIC(10,2),
  appointment_date TIMESTAMPTZ
);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Booking images (reference photos from clients)
-- ============================================
CREATE TABLE booking_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL
);

CREATE INDEX idx_booking_images_booking_id ON booking_images(booking_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on both tables
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_images ENABLE ROW LEVEL SECURITY;

-- Public can INSERT bookings (the booking form)
CREATE POLICY "Anyone can create a booking"
  ON bookings FOR INSERT
  WITH CHECK (true);

-- Public can INSERT booking images (upload with the form)
CREATE POLICY "Anyone can upload booking images"
  ON booking_images FOR INSERT
  WITH CHECK (true);

-- Only authenticated users (Lia) can SELECT/UPDATE/DELETE bookings
CREATE POLICY "Authenticated users can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (true);

-- Only authenticated users can view booking images
CREATE POLICY "Authenticated users can view booking images"
  ON booking_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete booking images"
  ON booking_images FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- Storage bucket for reference images
-- ============================================
-- NOTE: Run this separately in Supabase Dashboard → Storage → Create bucket
-- Bucket name: reference-images
-- Public: false (private — accessed via signed URLs)
-- Max file size: 10MB
-- Allowed MIME types: image/jpeg, image/png, image/webp, image/heic
