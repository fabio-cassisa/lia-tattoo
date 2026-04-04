-- ============================================================
-- Migration 018: Public-facing CMS polish fields
-- ============================================================

INSERT INTO site_content (key, title, description, source_en, it_override, sv_override, da_override, content_kind)
VALUES
  (
    'home_hero_title',
    'Homepage hero title',
    'Main homepage headline. Keep this short because it sits above the fold.',
    'liagiorgi.one.ttt',
    NULL,
    NULL,
    NULL,
    'text'
  ),
  (
    'home_hero_subtitle',
    'Homepage hero subtitle',
    'Small uppercase line under the homepage title.',
    'Malmö · Copenhagen based',
    NULL,
    NULL,
    NULL,
    'text'
  ),
  (
    'about_profile_image_url',
    'About portrait image URL',
    'Public image URL or site-relative path for the portrait on the About page. Leave blank to hide the image.',
    '',
    NULL,
    NULL,
    NULL,
    'text'
  )
ON CONFLICT (key) DO NOTHING;
