-- ============================================================
-- v6.38 — FLEXIBLE ROUNDS + TIMER + INVITE CODES
-- Organizer picks 1-3 rounds at creation; each round carries a
-- requirement (what students must submit) and an AI-usage flag.
-- Events can show a big countdown timer on the student round
-- page, and can be invite-code-only (paid events: only students
-- with a code issued by the organizer can join).
-- Auto-applies at backend boot via runMigrations; idempotent.
-- ============================================================

ALTER TABLE hackathon_rounds
ADD COLUMN IF NOT EXISTS requirement TEXT;

ALTER TABLE hackathon_rounds
ADD COLUMN IF NOT EXISTS ai_usage_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS show_timer BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS invite_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS event_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hackathon_id UUID NOT NULL
    REFERENCES hackathons(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(32) NOT NULL,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hackathon_id, email),
  UNIQUE (hackathon_id, code)
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_hackathon
ON event_invite_codes(hackathon_id);
