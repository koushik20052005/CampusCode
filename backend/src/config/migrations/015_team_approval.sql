-- ============================================================
-- 015 — Round 1 team approval flow
-- Adds leader approval tracking to round1_submissions.
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE round1_submissions
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE round1_submissions
  ADD COLUMN IF NOT EXISTS leader_note TEXT;

-- Proposals awaiting a leader decision are looked up per team.
CREATE INDEX IF NOT EXISTS idx_r1_submissions_approval
  ON round1_submissions (hackathon_id, team_id, status);
