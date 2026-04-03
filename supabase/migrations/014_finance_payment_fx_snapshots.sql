-- ============================================================
-- Migration 014: Finance payment FX snapshots
-- ============================================================

ALTER TABLE finance_payments
  ADD COLUMN IF NOT EXISTS fx_eur_to_sek numeric(12,6),
  ADD COLUMN IF NOT EXISTS fx_eur_to_dkk numeric(12,6),
  ADD COLUMN IF NOT EXISTS fx_source text;

ALTER TABLE finance_payments
  DROP CONSTRAINT IF EXISTS finance_payments_fx_eur_to_sek_check;

ALTER TABLE finance_payments
  ADD CONSTRAINT finance_payments_fx_eur_to_sek_check
  CHECK (fx_eur_to_sek IS NULL OR fx_eur_to_sek > 0);

ALTER TABLE finance_payments
  DROP CONSTRAINT IF EXISTS finance_payments_fx_eur_to_dkk_check;

ALTER TABLE finance_payments
  ADD CONSTRAINT finance_payments_fx_eur_to_dkk_check
  CHECK (fx_eur_to_dkk IS NULL OR fx_eur_to_dkk > 0);

ALTER TABLE finance_payments
  DROP CONSTRAINT IF EXISTS finance_payments_fx_source_check;

ALTER TABLE finance_payments
  ADD CONSTRAINT finance_payments_fx_source_check
  CHECK (fx_source IS NULL OR fx_source IN ('live', 'fallback'));
