-- ============================================================
-- Migration 013: Finance studio fee base override
-- ============================================================

ALTER TABLE finance_payments
  ADD COLUMN IF NOT EXISTS studio_fee_base_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS studio_fee_base_currency finance_currency;

ALTER TABLE finance_payments
  DROP CONSTRAINT IF EXISTS finance_payments_studio_fee_base_amount_check;

ALTER TABLE finance_payments
  ADD CONSTRAINT finance_payments_studio_fee_base_amount_check
  CHECK (studio_fee_base_amount IS NULL OR studio_fee_base_amount >= 0);

ALTER TABLE finance_payments
  DROP CONSTRAINT IF EXISTS finance_payments_studio_fee_base_pair_check;

ALTER TABLE finance_payments
  ADD CONSTRAINT finance_payments_studio_fee_base_pair_check
  CHECK (
    (studio_fee_base_amount IS NULL AND studio_fee_base_currency IS NULL)
    OR
    (studio_fee_base_amount IS NOT NULL AND studio_fee_base_currency IS NOT NULL)
  );
