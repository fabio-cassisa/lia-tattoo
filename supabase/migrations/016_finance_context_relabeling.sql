-- ============================================================
-- Migration 016: Finance context relabeling and defaults
-- ============================================================

UPDATE finance_context_settings
SET label = 'Malmö / Diamant studio',
    default_currency = 'SEK'::finance_currency,
    default_fee_percentage = 30,
    sort_order = 0
WHERE context = 'malmo_studio';

UPDATE finance_context_settings
SET label = 'Copenhagen / Good Morning Tattoo studio',
    default_currency = 'DKK'::finance_currency,
    default_fee_percentage = 30,
    sort_order = 1
WHERE context = 'copenhagen_studio';

UPDATE finance_context_settings
SET label = 'Friuli / by appointment',
    default_currency = 'EUR'::finance_currency,
    default_fee_percentage = 0,
    sort_order = 2
WHERE context = 'private_home';

INSERT INTO finance_context_settings (
  context,
  label,
  default_currency,
  default_fee_percentage,
  sort_order,
  is_active
)
VALUES (
  'torino_studio',
  'Turin / Studio Etra',
  'EUR'::finance_currency,
  40,
  3,
  true
)
ON CONFLICT (context) DO UPDATE
SET label = EXCLUDED.label,
    default_currency = EXCLUDED.default_currency,
    default_fee_percentage = EXCLUDED.default_fee_percentage,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

UPDATE finance_context_settings
SET label = 'Touring / guest spots',
    default_currency = 'EUR'::finance_currency,
    default_fee_percentage = 40,
    sort_order = 4
WHERE context = 'guest_spot';
