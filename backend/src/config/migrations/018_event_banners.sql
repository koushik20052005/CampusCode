-- ============================================================
-- CAMPUSCODE EVENT BANNERS (v6.18 — banner system)
-- Organizer sets two banners per event: one web (desktop)
-- and one mobile. Both are plain image URLs; empty = no banner.
-- Display-only: changing a banner never affects scoring,
-- registration, or rounds, so it is editable in any state.
-- ============================================================

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS banner_web_url TEXT;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS banner_mobile_url TEXT;
