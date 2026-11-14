-- ============================================================
-- 034 — RE-INSERT FIRSTCOMMIT ROUND 3 (third attempt)
--
-- 032's time fixes applied (Koushik confirmed he never
-- changed the times himself), so 032 ran — but Round 3 is
-- still missing after 032 AND 033. The only DELETE of
-- hackathon_rounds anywhere in the backend is the Rounds
-- "Save configuration" endpoint: it deletes SCHEDULED rounds
-- beyond the saved count. So the restored Round 3 was deleted
-- again by a save made from a page loaded BEFORE the restore
-- (stale 2-round state). This file re-inserts it, and v6.62
-- also removes that DELETE from the endpoint, so a stale save
-- can never delete a round again.
--
-- Idempotent: ON CONFLICT DO NOTHING.
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
