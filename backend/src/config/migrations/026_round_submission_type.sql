-- ============================================================
-- v6.45 — PER-ROUND SUBMISSION TYPE + DEMO LINK FIELDS
-- Round 1 can be 'idea' (problem statement — the default,
-- unchanged behavior for FirstCommit '26) or 'demo' (GitHub
-- link + live demo link + optional PDF + note for the
-- organizer — the ReBuild '26 shape). Round 2 gains the same
-- demo fields and its PDF becomes optional.
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

-- Demo submissions carry links, not a statement.
ALTER TABLE round1_submissions
ALTER COLUMN problem_statement DROP NOT NULL;

ALTER TABLE round2_submissions
ADD COLUMN IF NOT EXISTS demo_url TEXT;

ALTER TABLE round2_submissions
ADD COLUMN IF NOT EXISTS organizer_note TEXT;
