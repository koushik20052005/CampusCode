-- =========================================================
-- 003_ai_analysis_jobs.sql
-- Automatic AI analysis queue for Round 1 / Round 2.
--
-- When a student submits R1 or R2, the backend enqueues a
-- PENDING job. A lightweight in-process worker picks jobs
-- up one at a time, calls Gemini, and stores the result —
-- so the organizer sees ready scores instead of waiting
-- 10-20s on a manual "Analyze" click.
-- =========================================================

CREATE TABLE IF NOT EXISTS ai_analysis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    round INTEGER NOT NULL
        CHECK (round IN (1, 2)),

    submission_id UUID NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),

    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,

    -- { overall_score, scores:{...}, feedback, recommendation, model_name }
    result JSONB,

    error TEXT,

    locked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One active pipeline per team per round.
    UNIQUE (hackathon_id, team_id, round)
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created
    ON ai_analysis_jobs (status, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_team_round
    ON ai_analysis_jobs (hackathon_id, team_id, round);
