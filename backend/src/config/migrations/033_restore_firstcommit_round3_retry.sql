-- ============================================================
-- 033 — RE-INSERT FIRSTCOMMIT ROUND 3 (retry of 032's insert)
--
-- Same insert as 032, rewritten 14 Nov evening as plain SQL
-- (no DO block) for the same reason: 032/033 first shipped
-- with a DO $$ block — the only procedural block in the whole
-- migrations folder — and Round 3 still did not appear after
-- two pushes, while migration errors are swallowed at boot
-- (server stays healthy), so a silently-failing DO block is
-- the prime suspect. Plain INSERT ... SELECT like a normal
-- migration. Idempotent: ON CONFLICT DO NOTHING.
-- Auto-applies at backend boot via runMigrations.
-- ============================================================

INSERT INTO hackathon_rounds (
  hackathon_id, round_number, title,
  requirement, ai_usage_required, status,
  start_at, end_at, show_timer, submission_type
)
SELECT
  h.id, 3, 'Round 3 — Grand Finale',
  'Live finale: GitHub repo link + demo video link required; live demo 5 min + 2 min Q&A, winners announced 6:30 PM',
  false, 'SCHEDULED',
  '2026-11-17 10:00:00+05:30',
  '2026-11-17 22:01:00+05:30',
  true, 'demo'
FROM hackathons h
WHERE h.title ILIKE '%FirstCommit%'
  AND EXISTS (
    SELECT 1
    FROM hackathon_rounds r
    WHERE r.hackathon_id = h.id
      AND r.round_number = 1
      AND r.title ILIKE '%Idea Screening%'
  )
ON CONFLICT (hackathon_id, round_number) DO NOTHING;
