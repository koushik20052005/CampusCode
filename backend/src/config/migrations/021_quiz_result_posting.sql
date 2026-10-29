-- 021_quiz_result_posting.sql — Quiz Manager results posting (v6.22)
-- Per-student result release: a student sees their score only after
-- the organizer posts it for them. Idempotent; auto-applies at boot.
ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS result_posted BOOLEAN NOT NULL DEFAULT FALSE;
