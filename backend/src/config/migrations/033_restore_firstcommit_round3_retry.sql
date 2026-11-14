-- ============================================================
-- 033 — RE-INSERT FIRSTCOMMIT ROUND 3 (retry of 032's insert)
--
-- 032 applied its time fixes (R1 end 10:00 PM Sat 14 Nov,
-- R2 end 10:01 AM Mon 16 Nov — both confirmed live on the
-- Rounds page 14 Nov 16:55 IST), so 032 ran. But the Round 3
-- row is still missing. The only deletion path in the code is
-- the Rounds "Save configuration" endpoint, which deletes
-- SCHEDULED rounds beyond the saved count — so the restored
-- Round 3 was almost certainly deleted again by a save made
-- with only 2 rounds loaded. Re-insert it.
--
-- Idempotent: ON CONFLICT DO NOTHING. If the FirstCommit
-- hackathon cannot be found, logs a notice and does nothing
-- (never throws, so later migrations still run).
--
-- NOTE: do NOT press "Save configuration" on the Rounds page
-- until Round 3 is visible — saving with 2 rounds loaded
-- deletes it again. Once it shows, saves include all 3.
-- Auto-applies at backend boot via runMigrations.
-- ============================================================

DO $$
DECLARE
  fc_id UUID;
BEGIN
  SELECT h.id INTO fc_id
  FROM hackathons h
  WHERE h.title ILIKE '%FirstCommit%'
    AND EXISTS (
      SELECT 1
      FROM hackathon_rounds r
      WHERE r.hackathon_id = h.id
        AND r.round_number = 1
        AND r.title ILIKE '%Idea Screening%'
    )
  LIMIT 1;

  IF fc_id IS NULL THEN
    RAISE NOTICE '033: FirstCommit hackathon not found, skipping';
    RETURN;
  END IF;

  INSERT INTO hackathon_rounds (
    hackathon_id, round_number, title,
    requirement, ai_usage_required, status,
    start_at, end_at, show_timer, submission_type
  )
  VALUES (
    fc_id, 3, 'Round 3 — Grand Finale',
    'Live finale: GitHub repo link + demo video link required; live demo 5 min + 2 min Q&A, winners announced 6:30 PM',
    false, 'SCHEDULED',
    '2026-11-17 10:00:00+05:30',
    '2026-11-17 22:01:00+05:30',
    true, 'demo'
  )
  ON CONFLICT (hackathon_id, round_number) DO NOTHING;
END $$;
