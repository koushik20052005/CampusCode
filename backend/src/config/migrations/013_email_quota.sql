-- =========================================================
-- 013_email_quota.sql
-- v6.15: daily email quota tracking (Brevo free tier = 300/day)
-- =========================================================

CREATE TABLE IF NOT EXISTS email_quota (
    day DATE PRIMARY KEY,
    sent_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
