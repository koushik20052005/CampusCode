-- ============================================================
-- v6.44 — PER-ROUND TIMER + PER-ROUND SCHEDULE AT CREATION
-- The timer moves from one event-wide switch to a flag on each
-- round, so the organizer can show it for Round 1 only, all
-- rounds, or none. NULL means "fall back to the event's
-- show_timer", so rounds created before this keep today's
-- behavior exactly (their flag is NULL, the event flag rules).
-- Auto-applies at backend boot via runMigrations; idempotent.
-- ============================================================

ALTER TABLE hackathon_rounds
ADD COLUMN IF NOT EXISTS show_timer BOOLEAN;
