-- =========================================================
-- 008_round1_criterion_scores.sql
-- The Round 1 AI analyzer computes five criterion scores
-- (novelty, relevance, innovation, technical, impact) but the
-- worker and the admin endpoint only persisted the overall
-- score. The organizer list cards therefore can only show a
-- bare number with no breakdown table. This stores the five
-- criterion scores so the UI can show the full table
-- everywhere (list + detail).
-- =========================================================

ALTER TABLE round1_submissions
    ADD COLUMN IF NOT EXISTS novelty_score NUMERIC(5,2);

ALTER TABLE round1_submissions
    ADD COLUMN IF NOT EXISTS relevance_score NUMERIC(5,2);

ALTER TABLE round1_submissions
    ADD COLUMN IF NOT EXISTS innovation_score NUMERIC(5,2);

ALTER TABLE round1_submissions
    ADD COLUMN IF NOT EXISTS technical_score NUMERIC(5,2);

ALTER TABLE round1_submissions
    ADD COLUMN IF NOT EXISTS impact_score NUMERIC(5,2);
