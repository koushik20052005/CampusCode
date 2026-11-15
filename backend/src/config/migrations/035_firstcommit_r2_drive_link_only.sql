-- ============================================================
-- 035 — FIRSTCOMMIT ROUND 2: DRIVE LINK + NOTE ONLY
--
-- Koushik (15 Nov 2026, ~09:51 IST, from the live R2
-- screenshot): the R2 student form must show ONLY the
-- Google Drive PPT/PDF link upload and the note for the
-- organizer. GitHub + live demo are removed from the R2 UI
-- (frontend, v6.65). The round's own requirement text —
-- which still said "PDF optional" and "no R1 cut" — is
-- corrected here, and ai_usage_required is set false so the
-- page stops saying "AI usage: Required" (AI-made PDFs or
-- PPTs are not acceptable for R2).
--
-- Idempotent: plain UPDATE, safe to re-run.
-- Auto-applies at backend boot via runMigrations.
-- ============================================================

UPDATE hackathon_rounds
SET
  requirement = 'Upload your PPT or PDF to Google Drive and paste the shareable link (anyone with the link can view) in the Google Drive link field below. Only teams selected in Round 1 can submit. A short note for the organizer is optional. AI-made PDFs or PPTs are not acceptable. Top 10 teams advance to the Grand Finale.',
  ai_usage_required = false
WHERE round_number = 2
  AND hackathon_id IN (
    SELECT h.id FROM hackathons h
    WHERE h.title ILIKE '%FirstCommit%'
      AND EXISTS (
        SELECT 1 FROM hackathon_rounds r
        WHERE r.hackathon_id = h.id
          AND r.round_number = 1
          AND r.title ILIKE '%Idea Screening%'
      )
  );
