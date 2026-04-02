-- ============================================================
-- Migration 009: Finance Sweden preview settings
-- ============================================================

ALTER TABLE finance_settings
  ADD COLUMN IF NOT EXISTS sweden_preview_label text NOT NULL DEFAULT 'Sweden preview',
  ADD COLUMN IF NOT EXISTS sweden_preview_rate numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sweden_preview_fixed_monthly_cost numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE finance_settings
  ADD CONSTRAINT finance_settings_sweden_preview_rate_check
  CHECK (sweden_preview_rate >= 0 AND sweden_preview_rate <= 100);

ALTER TABLE finance_settings
  ADD CONSTRAINT finance_settings_sweden_preview_fixed_monthly_cost_check
  CHECK (sweden_preview_fixed_monthly_cost >= 0);
