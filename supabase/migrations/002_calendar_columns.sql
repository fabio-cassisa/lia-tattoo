-- Phase 3: Add calendar integration columns to bookings table
-- Run this in Supabase Dashboard → SQL Editor

-- End time for the selected appointment slot (Malmö only)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS appointment_end timestamptz;

-- Google Calendar event ID (set when deposit is paid and event is created)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS calendar_event_id text;

-- Free-text preferred dates (Copenhagen only — no fixed calendar)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preferred_dates text;
