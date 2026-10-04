-- =========================================================
-- 005_round3_decision.sql
-- The organizer/final/leaderboard/admin controllers all
-- read and write round3_submissions.decision
-- ('SELECTED' / 'REJECTED' / NULL), but migration 001 never
-- created the column. This adds it.
-- =========================================================

ALTER TABLE round3_submissions
    ADD COLUMN IF NOT EXISTS decision VARCHAR(20)
        CHECK (decision IN ('SELECTED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS idx_round3_submissions_decision
    ON round3_submissions (decision);
