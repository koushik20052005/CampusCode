-- =========================================================
-- 020_age_confirmation.sql — 18+ age declaration at signup (DPDP)
-- Stores the student's age confirmation from the register page.
-- Idempotent: safe to re-run (IF NOT EXISTS).
-- =========================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS age_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS age_confirmed_at TIMESTAMPTZ;
