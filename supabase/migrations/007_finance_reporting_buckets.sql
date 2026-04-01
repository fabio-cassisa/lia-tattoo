-- ============================================================
-- Migration 007: Finance reporting buckets and processor fees
-- ============================================================

ALTER TABLE finance_settings
  ADD COLUMN IF NOT EXISTS card_processor_fee_percentage numeric(5,2) NOT NULL DEFAULT 1.95;

ALTER TABLE finance_settings
  ADD CONSTRAINT finance_settings_card_processor_fee_percentage_check
  CHECK (card_processor_fee_percentage >= 0 AND card_processor_fee_percentage <= 100);

ALTER TABLE finance_payments
  ADD COLUMN IF NOT EXISTS reporting_currency finance_currency,
  ADD COLUMN IF NOT EXISTS processor_fee_percentage numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE finance_payments
  ADD CONSTRAINT finance_payments_processor_fee_percentage_check
  CHECK (processor_fee_percentage >= 0 AND processor_fee_percentage <= 100);

UPDATE finance_payments AS payment
SET reporting_currency = CASE project.work_context
  WHEN 'malmo_studio' THEN 'SEK'::finance_currency
  WHEN 'copenhagen_studio' THEN 'DKK'::finance_currency
  WHEN 'guest_spot' THEN 'EUR'::finance_currency
  WHEN 'private_home' THEN 'EUR'::finance_currency
END
FROM finance_projects AS project
WHERE payment.project_id = project.id
  AND payment.reporting_currency IS NULL;

UPDATE finance_payments
SET processor_fee_percentage = 1.95
WHERE payment_method = 'card'
  AND processor_fee_percentage = 0;

ALTER TABLE finance_payments
  ALTER COLUMN reporting_currency SET NOT NULL;
