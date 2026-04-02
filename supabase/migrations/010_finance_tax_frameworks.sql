-- ============================================================
-- Migration 010: Finance tax framework settings
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'finance_tax_framework'
  ) THEN
    CREATE TYPE finance_tax_framework AS ENUM ('italy', 'sweden');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'finance_italy_inps_regime'
  ) THEN
    CREATE TYPE finance_italy_inps_regime AS ENUM ('artigiani', 'commercianti');
  END IF;
END $$;

ALTER TABLE finance_settings
  ADD COLUMN IF NOT EXISTS active_tax_framework finance_tax_framework NOT NULL DEFAULT 'italy',
  ADD COLUMN IF NOT EXISTS italy_tax_label text NOT NULL DEFAULT 'Italy actual setup',
  ADD COLUMN IF NOT EXISTS italy_is_startup_eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS italy_startup_tax_rate numeric(5,2) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS italy_standard_tax_rate numeric(5,2) NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS italy_profitability_coefficient numeric(5,2) NOT NULL DEFAULT 67,
  ADD COLUMN IF NOT EXISTS italy_inps_regime finance_italy_inps_regime NOT NULL DEFAULT 'artigiani',
  ADD COLUMN IF NOT EXISTS italy_inps_min_taxable_income numeric(12,2) NOT NULL DEFAULT 18555,
  ADD COLUMN IF NOT EXISTS italy_inps_fixed_annual_contribution numeric(12,2) NOT NULL DEFAULT 4460.64,
  ADD COLUMN IF NOT EXISTS italy_inps_variable_rate numeric(5,2) NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS italy_apply_forfettario_inps_reduction boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sweden_tax_label text NOT NULL DEFAULT 'Sweden comparison setup',
  ADD COLUMN IF NOT EXISTS sweden_self_employment_contribution_rate numeric(5,2) NOT NULL DEFAULT 28.97,
  ADD COLUMN IF NOT EXISTS sweden_municipal_tax_rate numeric(5,2) NOT NULL DEFAULT 32.41,
  ADD COLUMN IF NOT EXISTS sweden_state_tax_threshold numeric(12,2) NOT NULL DEFAULT 625800,
  ADD COLUMN IF NOT EXISTS sweden_state_tax_rate numeric(5,2) NOT NULL DEFAULT 20;

ALTER TABLE finance_settings
  DROP CONSTRAINT IF EXISTS finance_settings_italy_startup_tax_rate_check,
  DROP CONSTRAINT IF EXISTS finance_settings_italy_standard_tax_rate_check,
  DROP CONSTRAINT IF EXISTS finance_settings_italy_profitability_coefficient_check,
  DROP CONSTRAINT IF EXISTS finance_settings_italy_inps_min_taxable_income_check,
  DROP CONSTRAINT IF EXISTS finance_settings_italy_inps_fixed_annual_contribution_check,
  DROP CONSTRAINT IF EXISTS finance_settings_italy_inps_variable_rate_check,
  DROP CONSTRAINT IF EXISTS finance_settings_sweden_self_employment_contribution_rate_check,
  DROP CONSTRAINT IF EXISTS finance_settings_sweden_municipal_tax_rate_check,
  DROP CONSTRAINT IF EXISTS finance_settings_sweden_state_tax_threshold_check,
  DROP CONSTRAINT IF EXISTS finance_settings_sweden_state_tax_rate_check;

ALTER TABLE finance_settings
  ADD CONSTRAINT finance_settings_italy_startup_tax_rate_check
  CHECK (italy_startup_tax_rate >= 0 AND italy_startup_tax_rate <= 100),
  ADD CONSTRAINT finance_settings_italy_standard_tax_rate_check
  CHECK (italy_standard_tax_rate >= 0 AND italy_standard_tax_rate <= 100),
  ADD CONSTRAINT finance_settings_italy_profitability_coefficient_check
  CHECK (italy_profitability_coefficient >= 0 AND italy_profitability_coefficient <= 100),
  ADD CONSTRAINT finance_settings_italy_inps_min_taxable_income_check
  CHECK (italy_inps_min_taxable_income >= 0),
  ADD CONSTRAINT finance_settings_italy_inps_fixed_annual_contribution_check
  CHECK (italy_inps_fixed_annual_contribution >= 0),
  ADD CONSTRAINT finance_settings_italy_inps_variable_rate_check
  CHECK (italy_inps_variable_rate >= 0 AND italy_inps_variable_rate <= 100),
  ADD CONSTRAINT finance_settings_sweden_self_employment_contribution_rate_check
  CHECK (sweden_self_employment_contribution_rate >= 0 AND sweden_self_employment_contribution_rate <= 100),
  ADD CONSTRAINT finance_settings_sweden_municipal_tax_rate_check
  CHECK (sweden_municipal_tax_rate >= 0 AND sweden_municipal_tax_rate <= 100),
  ADD CONSTRAINT finance_settings_sweden_state_tax_threshold_check
  CHECK (sweden_state_tax_threshold >= 0),
  ADD CONSTRAINT finance_settings_sweden_state_tax_rate_check
  CHECK (sweden_state_tax_rate >= 0 AND sweden_state_tax_rate <= 100);
