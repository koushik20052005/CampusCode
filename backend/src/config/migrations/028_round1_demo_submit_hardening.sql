-- ============================================================
-- v6.50 — ROUND 1 DEMO SUBMIT HARDENING
-- Re-asserts the v6.45 demo-submission schema idempotently.
-- If migration 026 was only partially applied on the live DB
-- (e.g. a boot-time failure stopped the runner mid-file),
-- a demo Round 1 INSERT fails with a 500 ("Failed to submit
-- Round 1 idea") even though the form itself renders in demo
-- mode. Every statement here is safe to re-run: it is a no-op
-- when 026 already applied fully.
-- Auto-applies at backend boot via runMigrations; idempotent.
-- ============================================================

ALTER TABLE hackathon_rounds
ADD COLUMN IF NOT EXISTS submission_type VARCHAR(20) NOT NULL DEFAULT 'idea';

ALTER TABLE round1_submissions
ADD COLUMN IF NOT EXISTS github_url TEXT;

ALTER TABLE round1_submissions
ADD COLUMN IF NOT EXISTS demo_url TEXT;

ALTER TABLE round1_submissions
ADD COLUMN IF NOT EXISTS pdf_url TEXT;

ALTER TABLE round1_submissions
ADD COLUMN IF NOT EXISTS organizer_note TEXT;

-- Demo submissions carry links, not a statement, so the
-- statement column must accept NULL or the demo INSERT fails.
ALTER TABLE round1_submissions
ALTER COLUMN problem_statement DROP NOT NULL;

ALTER TABLE round2_submissions
ADD COLUMN IF NOT EXISTS demo_url TEXT;

ALTER TABLE round2_submissions
ADD COLUMN IF NOT EXISTS organizer_note TEXT;
