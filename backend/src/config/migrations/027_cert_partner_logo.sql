-- ============================================================
-- 027 — Certificate partner logo + theme CHECK fix
-- partner_logo: organizer toggle at issue time, stored per
-- certificate so downloads re-render the same strip.
-- The 016 theme CHECK only allowed 3 themes, so issuing any
-- v6.35/v6.36 theme would have failed — dropped here; the
-- controller's validTheme() is the guard now.
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS partner_logo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE certificates
  DROP CONSTRAINT IF EXISTS certificates_theme_check;
