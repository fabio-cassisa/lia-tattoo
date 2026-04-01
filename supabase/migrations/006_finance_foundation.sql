-- ============================================================
-- Migration 006: Finance tracker foundation
-- ============================================================

-- ── Enums ───────────────────────────────────────────────────

CREATE TYPE finance_currency AS ENUM ('SEK', 'DKK', 'EUR');

CREATE TYPE finance_payment_method AS ENUM (
  'cash',
  'card',
  'bank_transfer',
  'paypal',
  'revolut',
  'swish'
);

CREATE TYPE finance_work_context AS ENUM (
  'malmo_studio',
  'copenhagen_studio',
  'guest_spot',
  'private_home'
);

-- ── Work context defaults ───────────────────────────────────

CREATE TABLE finance_context_settings (
  context finance_work_context PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  label text NOT NULL,
  default_currency finance_currency NOT NULL,
  default_fee_percentage numeric(5,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  CHECK (default_fee_percentage >= 0 AND default_fee_percentage <= 100)
);

CREATE TRIGGER finance_context_settings_updated_at
  BEFORE UPDATE ON finance_context_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

INSERT INTO finance_context_settings (
  context,
  label,
  default_currency,
  default_fee_percentage,
  sort_order
)
VALUES
  ('malmo_studio', 'Malmö studio', 'SEK', 30, 0),
  ('copenhagen_studio', 'Copenhagen studio', 'DKK', 30, 1),
  ('guest_spot', 'Guest spot', 'EUR', 40, 2),
  ('private_home', 'Private / home', 'EUR', 0, 3)
ON CONFLICT (context) DO NOTHING;

-- ── Finance settings singleton ──────────────────────────────

CREATE TABLE finance_settings (
  scope text PRIMARY KEY DEFAULT 'default' CHECK (scope = 'default'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reporting_currency_primary finance_currency NOT NULL DEFAULT 'SEK',
  reporting_currency_secondary finance_currency NOT NULL DEFAULT 'EUR',
  use_live_exchange_rates boolean NOT NULL DEFAULT true,
  fallback_sek_to_eur numeric(12,6),
  fallback_dkk_to_eur numeric(12,6),
  fallback_eur_to_sek numeric(12,6),
  card_invoice_default boolean NOT NULL DEFAULT true
);

CREATE TRIGGER finance_settings_updated_at
  BEFORE UPDATE ON finance_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

INSERT INTO finance_settings (scope)
VALUES ('default')
ON CONFLICT (scope) DO NOTHING;

-- ── Projects ────────────────────────────────────────────────

CREATE TABLE finance_projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  project_label text NOT NULL,
  session_date date,
  work_context finance_work_context NOT NULL,
  context_label text,
  notes text
);

CREATE TRIGGER finance_projects_updated_at
  BEFORE UPDATE ON finance_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_finance_projects_booking_id
  ON finance_projects (booking_id);

CREATE INDEX idx_finance_projects_work_context_session_date
  ON finance_projects (work_context, session_date DESC);

-- ── Payments ────────────────────────────────────────────────

CREATE TABLE finance_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES finance_projects(id) ON DELETE CASCADE,
  payment_label text NOT NULL DEFAULT 'session payment',
  payment_date date NOT NULL,
  gross_amount numeric(10,2) NOT NULL,
  currency finance_currency NOT NULL,
  payment_method finance_payment_method NOT NULL,
  fee_percentage numeric(5,2) NOT NULL DEFAULT 0,
  invoice_needed boolean NOT NULL DEFAULT false,
  invoice_done boolean NOT NULL DEFAULT false,
  invoice_reference text,
  notes text,
  CHECK (gross_amount >= 0),
  CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
  CHECK (NOT invoice_done OR invoice_needed)
);

CREATE TRIGGER finance_payments_updated_at
  BEFORE UPDATE ON finance_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_finance_payments_project_id
  ON finance_payments (project_id);

CREATE INDEX idx_finance_payments_payment_date
  ON finance_payments (payment_date DESC);

CREATE INDEX idx_finance_payments_invoice_status
  ON finance_payments (invoice_needed, invoice_done, payment_method);

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE finance_context_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage finance context settings"
  ON finance_context_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage finance settings"
  ON finance_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage finance projects"
  ON finance_projects FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage finance payments"
  ON finance_payments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
