-- ============================================================
-- v6.39 — PARTICIPANT TYPE (TEAM SIZE PER EVENT)
-- The organizer picks at creation: Individual (1), up to 2,
-- up to 3, up to 4. Default 4 preserves every existing event's
-- behaviour. The cap is enforced at every add-member path;
-- HackMate recommendations use it for available slots.
-- Auto-applies at backend boot via runMigrations; idempotent.
-- ============================================================

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS max_team_size INTEGER NOT NULL DEFAULT 4;

ALTER TABLE hackathons
ADD CONSTRAINT hackathons_max_team_size_range
CHECK (max_team_size BETWEEN 1 AND 4);
