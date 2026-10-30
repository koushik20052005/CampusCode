-- 022_admin_single_session.sql
-- Single active session for ADMIN accounts (v6.30).
-- Every successful admin login bumps token_version and the new JWT
-- carries it as the `tv` claim. The auth middleware rejects admin
-- tokens whose tv no longer matches the row, so a new login kicks
-- every older admin session out. Students/organizers are unaffected.
-- Idempotent: safe to apply more than once.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
