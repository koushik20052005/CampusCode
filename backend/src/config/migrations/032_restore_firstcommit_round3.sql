-- ============================================================
-- 032 — RESTORE FIRSTCOMMIT ROUND 3 + FIX ROUND END TIMES
--
-- Round 3 (Grand Finale, Mon 17 Nov) vanished from the
-- organizer Rounds page. The panel renders exactly the rows
-- in hackathon_rounds, and the Rounds "Save configuration"
-- endpoint deletes SCHEDULED rounds beyond the saved count,
-- so a save with only 2 rounds removed it. Re-insert it.
--
-- Also fixes the two wrong end times spotted 14 Nov 2026:
-- R1 showed 9:00 PM (locked: 10:00 PM Sat 14 Nov) and R2
-- showed 9:00 PM Sun 15 Nov (locked: Mon 16 Nov 10:01 AM).
-- Round times are display-only (the lifecycle is manual and
-- the code never enforces start/end), so this changes no
-- cutoff — it only shows students the right times.
--
-- REWRITTEN 14 Nov evening as plain SQL (no DO block):
-- 032/033 first shipped with a DO $$ block — the only
-- procedural block in the whole migrations folder — and
-- Round 3 still did not appear after two pushes, while
-- migration errors are swallowed at boot (server stays
-- healthy), so a silently-failing DO block is the prime
-- suspect. Plain statements like every other migration.
--
-- Idempotent: updates set the exact locked times, the insert
-- is ON CONFLICT DO NOTHING.
-- Auto-applies at backend boot via runMigrations.
-- ============================================================

-- R1 end: Sat 14 Nov 2026, 10:00 PM IST
UPDATE hackathon_rounds
SET end_at = '2026-11-14 22:00:00+05:30',
    updated_at = NOW()
WHERE round_number = 1
  AND hackathon_id IN (
    SELECT id FROM hackathons WHERE title ILIKE '%FirstCommit%'
  );

-- R2 end: Mon 16 Nov 2026, 10:01 AM IST
UPDATE hackathon_rounds
SET end_at = '2026-11-16 10:01:00+05:30',
    updated_at = NOW()
WHERE round_number = 2
  AND hackathon_id IN (
    SELECT id FROM hackathons WHERE title ILIKE '%FirstCommit%'
  );

-- Round 3: Grand Finale, Mon 17 Nov 2026, 10:00 AM - 10:01 PM IST
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
