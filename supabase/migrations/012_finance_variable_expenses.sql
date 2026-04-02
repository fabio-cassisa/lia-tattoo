-- ============================================================
-- Migration 012: Finance variable expenses
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'finance_variable_expense_category'
  ) THEN
    CREATE TYPE finance_variable_expense_category AS ENUM (
      'needles',
      'ink',
      'supplies',
      'equipment',
      'travel',
      'other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS finance_variable_expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expense_date date NOT NULL,
  label text NOT NULL,
  category finance_variable_expense_category NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency finance_currency NOT NULL DEFAULT 'EUR',
  notes text,
  CHECK (amount >= 0)
);

CREATE TRIGGER finance_variable_expenses_updated_at
  BEFORE UPDATE ON finance_variable_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_finance_variable_expenses_expense_date
  ON finance_variable_expenses (expense_date DESC);

ALTER TABLE finance_variable_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage finance variable expenses" ON finance_variable_expenses;

CREATE POLICY "Authenticated users can manage finance variable expenses"
  ON finance_variable_expenses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
