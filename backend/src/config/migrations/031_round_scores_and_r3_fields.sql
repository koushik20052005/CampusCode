-- ============================================================
-- 031 — ORGANIZER SCORE PER ROUND + R3 SUBMISSION FIELDS
-- Organizer scores every round out of 100 (R1/R2 decisions
-- gain a score column; R3 already scores on the submission).
-- R3 submissions gain organizer_note (required at submit)
-- and pdf_url (optional, Google Drive link).
-- Auto-applies at backend boot via runMigrations; idempotent.
-- ============================================================

ALTER TABLE round1_decisions
ADD COLUMN IF NOT EXISTS score NUMERIC(5,2)
CHECK (score BETWEEN 0 AND 100);

ALTER TABLE round2_decisions
ADD COLUMN IF NOT EXISTS score NUMERIC(5,2)
CHECK (score BETWEEN 0 AND 100);

ALTER TABLE round3_submissions
ADD COLUMN IF NOT EXISTS organizer_note TEXT;

ALTER TABLE round3_submissions
ADD COLUMN IF NOT EXISTS pdf_url TEXT;
