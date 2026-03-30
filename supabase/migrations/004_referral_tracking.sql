-- Add referral tracking columns to bookings table
-- Captures where the client came from (Instagram, direct, etc.)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS referrer text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_source text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_medium text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_campaign text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_content text DEFAULT NULL;

-- Index on utm_source for analytics queries
CREATE INDEX IF NOT EXISTS idx_bookings_utm_source ON bookings (utm_source)
  WHERE utm_source IS NOT NULL;

-- Index on referrer for grouping queries
CREATE INDEX IF NOT EXISTS idx_bookings_referrer ON bookings (referrer)
  WHERE referrer IS NOT NULL;
