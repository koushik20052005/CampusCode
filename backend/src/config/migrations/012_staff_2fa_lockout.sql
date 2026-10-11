-- =========================================================
-- 012_staff_2fa_lockout.sql
-- v6.13: staff 2FA keys (admin-managed, 8-digit, hashed) +
--        brute-force account lockout.
-- =========================================================

-- 8-digit static 2FA key for staff (ADMIN/ORGANIZER/SUB_ADMIN),
-- set by admin. Stored as SHA-256 hash, never plaintext.
ALTER TABLE users ADD COLUMN IF NOT EXISTS tfa_key_hash TEXT;

-- Brute-force protection: failed password attempts + lockout.
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
