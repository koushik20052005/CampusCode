-- =========================================================
-- 007_round3_review_columns.sql
-- The Round 3 organizer controller (organizerRound3.controller.js)
-- and the student Round 3 status endpoint
-- (studentRound3.controller.js) read and write
-- round3_submissions.score, .organizer_feedback, .reviewed_by
-- and .reviewed_at — but no migration ever created them.
-- Every Round 3 fetch/decide fails with:
--   column "score" does not exist
-- This adds them. (decision was added by 005.)
-- =========================================================

ALTER TABLE round3_submissions
    ADD COLUMN IF NOT EXISTS score NUMERIC(5,2);

ALTER TABLE round3_submissions
    ADD COLUMN IF NOT EXISTS organizer_feedback TEXT;

ALTER TABLE round3_submissions
    ADD COLUMN IF NOT EXISTS reviewed_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL;

ALTER TABLE round3_submissions
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
