-- =========================================================
-- 019_proctored_quiz.sql — v6.19 proctored quiz (Nov 1)
-- Terms acceptance + proctor flags on quiz_attempts.
-- Nothing here records video or audio: the flags only count
-- fullscreen exits and tab switches during an attempt.
-- Idempotent: safe to re-run (IF NOT EXISTS / guarded DO).
-- =========================================================

ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS fullscreen_exits INTEGER NOT NULL DEFAULT 0;

ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS tab_switches INTEGER NOT NULL DEFAULT 0;
