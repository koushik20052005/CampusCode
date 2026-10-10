-- =========================================================
-- 006_round1_ai_columns.sql
-- The Round 1 AI worker (aiAnalysis.worker.js), the organizer
-- Round 1 controller (organizerRound1.controller.js) and the
-- admin Round 1 AI analysis endpoint (ai.controller.js) all
-- read and write round1_submissions.ai_feedback,
-- .ai_recommendation and .ai_analyzed_at — but migration 001
-- only created ai_score. Without these columns every Round 1
-- fetch and every AI write fails with:
--   column "ai_feedback" does not exist
-- This adds them.
-- =========================================================

ALTER TABLE round1_submissions
    ADD COLUMN IF NOT EXISTS ai_feedback TEXT;

ALTER TABLE round1_submissions
    ADD COLUMN IF NOT EXISTS ai_recommendation VARCHAR(20);

ALTER TABLE round1_submissions
    ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;
