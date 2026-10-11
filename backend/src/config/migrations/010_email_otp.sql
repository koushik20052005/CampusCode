-- =========================================================
-- 010_email_otp.sql
-- Email OTP verification: stores hashed OTPs with expiry.
-- Powers registration/login verification and the mail system
-- (hackathon notifications, login alerts).
-- =========================================================

CREATE TABLE IF NOT EXISTS email_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'register',
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    used_at TIMESTAMPTZ,
    used_master BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email
    ON email_otps(email);

CREATE INDEX IF NOT EXISTS idx_email_otps_expires
    ON email_otps(expires_at);
