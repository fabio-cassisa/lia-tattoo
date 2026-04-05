-- ============================================================
-- Migration 019: Final public brand copy consistency pass
-- ============================================================

UPDATE site_content
SET source_en = 'Working from Studio Diamant in Malmö, with selected dates at Good Morning Tattoo in Copenhagen.'
WHERE key = 'about_studios_note'
  AND source_en = 'Resident at Studio Diamant in Malmö, with selected guest-spot dates at Good Morning Tattoo in Copenhagen.';

UPDATE site_content
SET source_en = 'Malmö is my main base. For Copenhagen dates and future travel announcements, check my Instagram.'
WHERE key = 'about_travel_note'
  AND source_en = 'Malmö is my main base. For Copenhagen guest-spot dates and future travel announcements, check my Instagram.';
