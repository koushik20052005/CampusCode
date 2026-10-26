-- ============================================================
-- 016 — Module 8: certificates
-- One row per person per hackathon per type. A winner also holds
-- a participation certificate, so the uniqueness is on
-- (hackathon_id, user_id, type), not on the person alone.
-- Idempotent: safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    team_id UUID
        REFERENCES teams(id)
        ON DELETE SET NULL,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    type VARCHAR(20) NOT NULL
        CHECK (type IN ('PARTICIPATION', 'WINNER')),

    place INTEGER
        CHECK (place IS NULL OR place IN (1, 2, 3)),

    theme VARCHAR(50) NOT NULL DEFAULT 'sidebar'
        CHECK (theme IN ('sidebar', 'constellation', 'blueprint')),

    code VARCHAR(32) NOT NULL UNIQUE,

    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT certificates_one_per_type
        UNIQUE (hackathon_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user
    ON certificates (user_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_certificates_hackathon
    ON certificates (hackathon_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_certificates_code
    ON certificates (code);
