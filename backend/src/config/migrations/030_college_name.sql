-- ============================================================
-- v6.57 — COLLEGE NAME on users (student Profile tab)
-- Students enter their college name in Profile; it is shown
-- on the profile display rows. Empty means "Not set".
-- Auto-applies at backend boot via runMigrations; idempotent.
-- ============================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS college_name TEXT;
