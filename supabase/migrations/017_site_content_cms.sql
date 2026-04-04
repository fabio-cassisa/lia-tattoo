-- ============================================================
-- Migration 017: Lightweight site content CMS
-- ============================================================

CREATE TABLE site_content (
  key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  title TEXT,
  description TEXT,
  source_en TEXT NOT NULL DEFAULT '',
  it_override TEXT,
  sv_override TEXT,
  da_override TEXT,
  content_kind TEXT NOT NULL DEFAULT 'text',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TRIGGER site_content_updated_at
  BEFORE UPDATE ON site_content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active site content"
  ON site_content FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Authenticated users can manage site content"
  ON site_content FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

ALTER TABLE portfolio_images
  ADD COLUMN IF NOT EXISTS featured_on_homepage BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_portfolio_homepage_featured
  ON portfolio_images (featured_on_homepage, is_visible, category, display_order);

INSERT INTO site_content (key, title, description, source_en, it_override, sv_override, da_override, content_kind)
VALUES
  (
    'booking_italy_note',
    'Booking Italy note',
    'Short helper note below the booking location selector.',
    'Planning something in Italy? Mention Friuli or Turin in your request, or reach out on Instagram and I''ll guide you from there.',
    NULL,
    NULL,
    NULL,
    'text'
  ),
  (
    'about_italy_note',
    'About Italy note',
    'Italy follow-up note on the public about page.',
    'If you''re planning a tattoo in Italy, mention Friuli or Turin in your request or message me on Instagram so we can line it up properly.',
    NULL,
    NULL,
    NULL,
    'text'
  ),
  (
    'about_bio',
    'About bio',
    'Main biography paragraph used on the homepage teaser and About page.',
    'Traditional tattoo artist based in Malmö, Sweden. Specializing in Old School tattoos — bold lines, rich colors, timeless designs.',
    NULL,
    NULL,
    NULL,
    'textarea'
  ),
  (
    'about_studios_note',
    'About studios note',
    'Studio context paragraph on the About page.',
    'Resident at Studio Diamant in Malmö, with selected guest-spot dates at Good Morning Tattoo in Copenhagen.',
    NULL,
    NULL,
    NULL,
    'textarea'
  ),
  (
    'about_travel_note',
    'About travel note',
    'Short travel / guest-spot note on the About page.',
    'Malmö is my main base. For Copenhagen guest-spot dates and future travel announcements, check my Instagram.',
    NULL,
    NULL,
    NULL,
    'textarea'
  ),
  (
    'home_quote',
    'Homepage quote intro',
    'First line of the homepage quote block.',
    'Bold lines, rich colors,',
    NULL,
    NULL,
    NULL,
    'text'
  ),
  (
    'home_quote_highlight',
    'Homepage quote highlight',
    'Highlighted second line of the homepage quote block.',
    'timeless designs.',
    NULL,
    NULL,
    NULL,
    'text'
  ),
  (
    'home_booking_cta_subtitle',
    'Homepage booking CTA subtitle',
    'Short subtitle for the homepage booking CTA block.',
    'Fill out the form and I''ll get back to you soon.',
    NULL,
    NULL,
    NULL,
    'text'
  )
ON CONFLICT (key) DO NOTHING;

UPDATE site_content
SET it_override = NULL,
    sv_override = NULL,
    da_override = NULL
WHERE key IN (
  'booking_italy_note',
  'about_italy_note',
  'about_bio',
  'about_studios_note',
  'about_travel_note',
  'home_quote',
  'home_quote_highlight',
  'home_booking_cta_subtitle'
);
