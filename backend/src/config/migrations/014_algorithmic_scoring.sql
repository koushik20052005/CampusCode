-- =========================================================
-- 014_algorithmic_scoring.sql
-- v6.16: "AI reads, algorithm decides" scoring (FirstCommit '26)
--
-- New algorithmic criteria live alongside the legacy
-- 0-100 columns (which now carry documented projections of
-- the algorithmic criteria, see scoring.service.js).
-- ai_score_log is the training dataset: every algorithmic
-- verdict + its extracted facts, with organizer overrides
-- logged for future model training.
-- Idempotent: safe to re-run (ADD COLUMN IF NOT EXISTS).
-- =========================================================

ALTER TABLE round1_submissions
  ADD COLUMN IF NOT EXISTS theme_fit_score INT,
  ADD COLUMN IF NOT EXISTS feasibility_score INT,
  ADD COLUMN IF NOT EXISTS clarity_score INT,
  ADD COLUMN IF NOT EXISTS theme_verdict TEXT,
  ADD COLUMN IF NOT EXISTS score_breakdown JSONB;

ALTER TABLE round2_ai_analysis
  ADD COLUMN IF NOT EXISTS theme_fit_score INT,
  ADD COLUMN IF NOT EXISTS feasibility_score INT,
  ADD COLUMN IF NOT EXISTS clarity_score INT,
  ADD COLUMN IF NOT EXISTS theme_verdict TEXT,
  ADD COLUMN IF NOT EXISTS score_breakdown JSONB;

CREATE TABLE IF NOT EXISTS ai_score_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hackathon_id UUID NOT NULL,
    team_id UUID NOT NULL,
    round INT NOT NULL,
    submission_id UUID NOT NULL,
    facts JSONB NOT NULL DEFAULT '{}'::jsonb,
    scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    theme_verdict TEXT,
    recommendation TEXT,
    organizer_override JSONB,
    model_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_score_log_hackathon
  ON ai_score_log (hackathon_id, round, created_at DESC);
