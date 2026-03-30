-- ============================================================
-- Migration 003: Portfolio images table
-- ============================================================

-- Category enum for portfolio images
CREATE TYPE portfolio_category AS ENUM ('flash', 'completed');

-- Portfolio images table
CREATE TABLE portfolio_images (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  title         TEXT,
  category      portfolio_category NOT NULL DEFAULT 'flash',
  storage_path  TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_visible    BOOLEAN NOT NULL DEFAULT TRUE,
  width         INT,
  height        INT
);

-- Auto-update updated_at
CREATE TRIGGER set_portfolio_images_updated_at
  BEFORE UPDATE ON portfolio_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Index for public queries (visible images ordered by display_order)
CREATE INDEX idx_portfolio_visible_order
  ON portfolio_images (is_visible, category, display_order);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE portfolio_images ENABLE ROW LEVEL SECURITY;

-- Public can read visible images
CREATE POLICY "Public can view visible portfolio images"
  ON portfolio_images FOR SELECT
  USING (is_visible = TRUE);

-- Authenticated users (Lia) can do everything
CREATE POLICY "Authenticated users can manage portfolio images"
  ON portfolio_images FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);
