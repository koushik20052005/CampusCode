-- ============================================================
-- 036 — FIRSTCOMMIT ROUND 3: NEW WINDOW + NO LINK CHECKS
--
-- R3 window moved (Koushik, 16 Nov 2026) from Tue 17 Nov
-- 10:00–22:01 to Mon 16 Nov 19:00 – Wed 18 Nov 19:00 IST.
-- Winners announced Sun 22 Nov.
-- Requirement text updated to the new rules: GitHub and/or
-- demo link (whichever applies) + demo video link in the
-- note; any link accepted, nothing is checked.
-- The link-check removal itself lives in
-- studentRound3.controller.js + StudentPanel.jsx (v6.66).
-- Idempotent: plain UPDATE; auto-applies at backend boot.
-- ============================================================

UPDATE hackathon_rounds r
SET
  start_at = '2026-11-16 19:00:00+05:30',
  end_at = '2026-11-18 19:00:00+05:30',
  requirement = 'GitHub and/or demo link (whichever applies to the project) + demo video link in the note; any link accepted, nothing is checked; winners announced Sun 22 Nov'
FROM hackathons h
WHERE r.hackathon_id = h.id
  AND r.round_number = 3
  AND h.title ILIKE '%FirstCommit%'
  AND EXISTS (
    SELECT 1
    FROM hackathon_rounds r1
    WHERE r1.hackathon_id = h.id
      AND r1.round_number = 1
      AND r1.title ILIKE '%Idea Screening%'
  );
