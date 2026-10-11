-- =========================================================
-- 009_feedback_draft.sql
-- Organizer feedback drafts: lets organizers save a feedback
-- note on a submission WITHOUT finalizing a decision.
-- (The *_decisions tables require a NOT NULL decision, so
-- drafts live on the submissions tables instead.)
-- =========================================================

ALTER TABLE round1_submissions
    ADD COLUMN IF NOT EXISTS feedback_draft TEXT;

ALTER TABLE round2_submissions
    ADD COLUMN IF NOT EXISTS feedback_draft TEXT;

ALTER TABLE round3_submissions
    ADD COLUMN IF NOT EXISTS feedback_draft TEXT;
