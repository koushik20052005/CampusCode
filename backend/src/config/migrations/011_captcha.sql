-- =========================================================
-- 011_captcha.sql
-- Server-side CAPTCHA challenges (free, no external service).
-- Used on login / OTP endpoints to block bots.
-- =========================================================

CREATE TABLE IF NOT EXISTS captchas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_captchas_expires
    ON captchas(expires_at);
