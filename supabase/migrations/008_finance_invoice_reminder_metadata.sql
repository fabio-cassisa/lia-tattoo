-- ============================================================
-- Migration 008: Finance invoice reminder metadata
-- ============================================================

ALTER TABLE finance_payments
  ADD COLUMN IF NOT EXISTS invoice_last_nudged_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_reminder_note text;
