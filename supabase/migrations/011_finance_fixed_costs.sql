-- ============================================================
-- Migration 011: Finance fixed costs
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'finance_fixed_cost_category'
  ) THEN
    CREATE TYPE finance_fixed_cost_category AS ENUM (
      'statutory',
      'software',
      'professional',
      'insurance',
      'other'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'finance_fixed_cost_cadence'
  ) THEN
    CREATE TYPE finance_fixed_cost_cadence AS ENUM ('monthly', 'quarterly', 'annual');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS finance_fixed_costs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  label text NOT NULL,
  category finance_fixed_cost_category NOT NULL,
  framework finance_tax_framework,
  currency finance_currency NOT NULL DEFAULT 'EUR',
  cadence finance_fixed_cost_cadence NOT NULL DEFAULT 'annual',
  annual_amount numeric(12,2),
  due_months integer[] NOT NULL DEFAULT '{}',
  notes text,
  already_counted_in_tax_model boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  CHECK (annual_amount IS NULL OR annual_amount >= 0),
  CHECK (due_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12])
);

CREATE TRIGGER finance_fixed_costs_updated_at
  BEFORE UPDATE ON finance_fixed_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_finance_fixed_costs_sort_order
  ON finance_fixed_costs (sort_order, created_at);

ALTER TABLE finance_fixed_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage finance fixed costs" ON finance_fixed_costs;

CREATE POLICY "Authenticated users can manage finance fixed costs"
  ON finance_fixed_costs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO finance_fixed_costs (
  label,
  category,
  framework,
  currency,
  cadence,
  annual_amount,
  due_months,
  notes,
  already_counted_in_tax_model,
  sort_order,
  is_active
)
SELECT *
FROM (
  VALUES
    (
      'INPS',
      'statutory'::finance_fixed_cost_category,
      'italy'::finance_tax_framework,
      'EUR'::finance_currency,
      'quarterly'::finance_fixed_cost_cadence,
      2902.08::numeric,
      ARRAY[2, 5, 8, 11],
      'Annual fixed INPS cash outflow, paid in four installments.',
      true,
      0,
      true
    ),
    (
      'INAIL',
      'statutory'::finance_fixed_cost_category,
      'italy'::finance_tax_framework,
      'EUR'::finance_currency,
      'quarterly'::finance_fixed_cost_cadence,
      164.83::numeric,
      ARRAY[2, 5, 8, 11],
      'Provisional planning amount based on the 2025 INAIL notice (156.75 rate + 8.08 adjustment). Keep editable until confirmed by accountant or latest notice.',
      false,
      1,
      true
    ),
    (
      'PEC',
      'software'::finance_fixed_cost_category,
      'italy'::finance_tax_framework,
      'EUR'::finance_currency,
      'annual'::finance_fixed_cost_cadence,
      32::numeric,
      ARRAY[1],
      NULL,
      false,
      2,
      true
    ),
    (
      'Invoicing app',
      'software'::finance_fixed_cost_category,
      'italy'::finance_tax_framework,
      'EUR'::finance_currency,
      'annual'::finance_fixed_cost_cadence,
      96::numeric,
      ARRAY[1],
      NULL,
      false,
      3,
      true
    ),
    (
      'Commercialista',
      'professional'::finance_fixed_cost_category,
      'italy'::finance_tax_framework,
      'EUR'::finance_currency,
      'annual'::finance_fixed_cost_cadence,
      550::numeric,
      ARRAY[1],
      NULL,
      false,
      4,
      true
    ),
    (
      'Insurance',
      'insurance'::finance_fixed_cost_category,
      'italy'::finance_tax_framework,
      'EUR'::finance_currency,
      'annual'::finance_fixed_cost_cadence,
      600::numeric,
      ARRAY[1],
      'Current active insurance as confirmed so far.',
      false,
      5,
      true
    )
) AS seed (
  label,
  category,
  framework,
  currency,
  cadence,
  annual_amount,
  due_months,
  notes,
  already_counted_in_tax_model,
  sort_order,
  is_active
)
WHERE NOT EXISTS (
  SELECT 1
  FROM finance_fixed_costs existing
  WHERE existing.label = seed.label
    AND existing.framework IS NOT DISTINCT FROM seed.framework
);

UPDATE finance_fixed_costs
SET annual_amount = 164.83,
    due_months = ARRAY[2, 5, 8, 11],
    notes = 'Provisional planning amount based on the 2025 INAIL notice (156.75 rate + 8.08 adjustment). Keep editable until confirmed by accountant or latest notice.'
WHERE label = 'INAIL'
  AND framework = 'italy';

UPDATE finance_settings
SET italy_inps_fixed_annual_contribution = 2902.08
WHERE scope = 'default'
  AND italy_inps_fixed_annual_contribution = 4460.64;
