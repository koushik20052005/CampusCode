-- ============================================================
-- 037 — Top 10 winner places (1-10) + FirstCommit '26 Top 10
-- achievement certificates.
--
-- Part A: the 016 place CHECK only allowed 1, 2, 3, so ranks
-- 4-10 could never be stored. Drop whatever CHECK mentions
-- place and replace it with 1-10.
--
-- Part B: register the 24 Top 10 achievement certificates that
-- were already mailed on 26 Nov 2026, with the exact codes
-- printed on them, so their QR codes verify. Hackathon, team
-- and user are resolved by title / team name / CampusCode ID;
-- a row whose references do not resolve inserts nothing
-- instead of failing. Idempotent: safe to re-run.
-- ============================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'certificates'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%place%'
  LOOP
    EXECUTE 'ALTER TABLE certificates DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE certificates
  ADD CONSTRAINT certificates_place_check
  CHECK (place IS NULL OR (place >= 1 AND place <= 10));


-- Rank 1 — Hackthon_builders — CC-A5YSQK
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Hackthon_builders') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-A5YSQK' LIMIT 1),
  'WINNER', 1, 'firstcommit-partitipation', FALSE, 'CC-CERT-VY95QTN9', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Hackthon_builders'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-A5YSQK')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 2 — The_builders — CC-ZRM2NN
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('The_builders') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-ZRM2NN' LIMIT 1),
  'WINNER', 2, 'firstcommit-partitipation', FALSE, 'CC-CERT-7ANWHWYR', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('The_builders'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-ZRM2NN')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 2 — The_builders — CC-8ZPDLZ
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('The_builders') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-8ZPDLZ' LIMIT 1),
  'WINNER', 2, 'firstcommit-partitipation', FALSE, 'CC-CERT-QEB3J6EY', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('The_builders'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-8ZPDLZ')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 2 — The_builders — CC-PLCVV8
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('The_builders') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-PLCVV8' LIMIT 1),
  'WINNER', 2, 'firstcommit-partitipation', FALSE, 'CC-CERT-NBM7U0TM', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('The_builders'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-PLCVV8')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 3 — Nikhil''s Team — CC-M5RWPL
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Nikhil''s Team') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-M5RWPL' LIMIT 1),
  'WINNER', 3, 'firstcommit-partitipation', FALSE, 'CC-CERT-FA88QPPV', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Nikhil''s Team'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-M5RWPL')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 4 — Godrick — CC-QRJ7LS
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Godrick') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-QRJ7LS' LIMIT 1),
  'WINNER', 4, 'firstcommit-partitipation', FALSE, 'CC-CERT-MJAH44DF', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Godrick'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-QRJ7LS')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 4 — Godrick — CC-39MWNA
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Godrick') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-39MWNA' LIMIT 1),
  'WINNER', 4, 'firstcommit-partitipation', FALSE, 'CC-CERT-BT76NZB7', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Godrick'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-39MWNA')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 4 — Godrick — CC-33R8YY
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Godrick') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-33R8YY' LIMIT 1),
  'WINNER', 4, 'firstcommit-partitipation', FALSE, 'CC-CERT-03CSN6JH', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Godrick'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-33R8YY')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 5 — Aevon — CC-A388BM
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Aevon') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-A388BM' LIMIT 1),
  'WINNER', 5, 'firstcommit-partitipation', FALSE, 'CC-CERT-O4WQS05F', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Aevon'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-A388BM')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 5 — Aevon — CC-M8CNJH
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Aevon') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-M8CNJH' LIMIT 1),
  'WINNER', 5, 'firstcommit-partitipation', FALSE, 'CC-CERT-WRS7SLZH', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Aevon'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-M8CNJH')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 5 — Aevon — CC-MVTDKE
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Aevon') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-MVTDKE' LIMIT 1),
  'WINNER', 5, 'firstcommit-partitipation', FALSE, 'CC-CERT-2OGQ01OZ', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Aevon'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-MVTDKE')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 6 — Stack Overflow — CC-DRH3JA
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Stack Overflow') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-DRH3JA' LIMIT 1),
  'WINNER', 6, 'firstcommit-partitipation', FALSE, 'CC-CERT-QWV3AMI6', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Stack Overflow'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-DRH3JA')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 6 — Stack Overflow — CC-9MR7YP
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Stack Overflow') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-9MR7YP' LIMIT 1),
  'WINNER', 6, 'firstcommit-partitipation', FALSE, 'CC-CERT-Y3QV1R6S', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Stack Overflow'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-9MR7YP')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 7 — Twin Athena — CC-K9DEK2
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Twin Athena') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-K9DEK2' LIMIT 1),
  'WINNER', 7, 'firstcommit-partitipation', FALSE, 'CC-CERT-LBGIJQMD', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Twin Athena'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-K9DEK2')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 7 — Twin Athena — CC-LXAAJT
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Twin Athena') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-LXAAJT' LIMIT 1),
  'WINNER', 7, 'firstcommit-partitipation', FALSE, 'CC-CERT-2NP1CGSQ', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Twin Athena'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-LXAAJT')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 7 — Twin Athena — CC-YGGBXF
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Twin Athena') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-YGGBXF' LIMIT 1),
  'WINNER', 7, 'firstcommit-partitipation', FALSE, 'CC-CERT-FGVTFM4C', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Twin Athena'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-YGGBXF')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 7 — Twin Athena — CC-LV8ATT
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Twin Athena') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-LV8ATT' LIMIT 1),
  'WINNER', 7, 'firstcommit-partitipation', FALSE, 'CC-CERT-UA4V8N9I', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Twin Athena'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-LV8ATT')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 8 — ByteX — CC-UAU3AF
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('ByteX') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-UAU3AF' LIMIT 1),
  'WINNER', 8, 'firstcommit-partitipation', FALSE, 'CC-CERT-B0IVFCNU', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('ByteX'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-UAU3AF')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 8 — ByteX — CC-GXJ6SG
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('ByteX') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-GXJ6SG' LIMIT 1),
  'WINNER', 8, 'firstcommit-partitipation', FALSE, 'CC-CERT-BY78G4PG', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('ByteX'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-GXJ6SG')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 8 — ByteX — CC-DWKDTB
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('ByteX') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-DWKDTB' LIMIT 1),
  'WINNER', 8, 'firstcommit-partitipation', FALSE, 'CC-CERT-3GB62O72', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('ByteX'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-DWKDTB')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 8 — ByteX — CC-CFNGD2
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('ByteX') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-CFNGD2' LIMIT 1),
  'WINNER', 8, 'firstcommit-partitipation', FALSE, 'CC-CERT-ZRFBA74W', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('ByteX'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-CFNGD2')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 9 — Optimus Prime — CC-AZPYTX
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Optimus Prime') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-AZPYTX' LIMIT 1),
  'WINNER', 9, 'firstcommit-partitipation', FALSE, 'CC-CERT-O2B4SSMD', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Optimus Prime'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-AZPYTX')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 9 — Optimus Prime — CC-3NYAKE
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Optimus Prime') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-3NYAKE' LIMIT 1),
  'WINNER', 9, 'firstcommit-partitipation', FALSE, 'CC-CERT-JQ57SWQ9', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('Optimus Prime'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-3NYAKE')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;

-- Rank 10 — spacex — CC-XF989T
INSERT INTO certificates (hackathon_id, team_id, user_id, type, place, theme, partner_logo, code, issued_at)
SELECT
  (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1),
  (SELECT id FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('spacex') LIMIT 1),
  (SELECT id FROM users WHERE campus_code_id = 'CC-XF989T' LIMIT 1),
  'WINNER', 10, 'firstcommit-partitipation', FALSE, 'CC-CERT-N7MY2CUC', '2026-11-26 12:00:00+05:30'
WHERE EXISTS (SELECT 1 FROM hackathons WHERE title ILIKE '%firstcommit%')
  AND EXISTS (SELECT 1 FROM teams WHERE hackathon_id = (SELECT id FROM hackathons WHERE title ILIKE '%firstcommit%' LIMIT 1) AND lower(name) = lower('spacex'))
  AND EXISTS (SELECT 1 FROM users WHERE campus_code_id = 'CC-XF989T')
ON CONFLICT (hackathon_id, user_id, type) DO NOTHING;
