-- ============================================================
-- v6.56 — TEAM INVITES (invite-by-CC-ID + accept/decline)
-- The leader invites a teammate by CampusCode ID (or QR scan);
-- the invitee must accept before they join — no more silent
-- direct-adds. One invite row per (team, user); re-inviting
-- after a decline/cancel updates the same row back to PENDING.
-- Auto-applies at backend boot via runMigrations; idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS team_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    invited_user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    invited_by UUID NOT NULL
        REFERENCES users(id),

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    responded_at TIMESTAMPTZ
);

-- One invite row per team+user: a re-invite after decline/cancel
-- updates the same row instead of inserting a second one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invites_team_user
ON team_invites(team_id, invited_user_id);

CREATE INDEX IF NOT EXISTS idx_team_invites_user_status
ON team_invites(invited_user_id, status);

CREATE INDEX IF NOT EXISTS idx_team_invites_team_status
ON team_invites(team_id, status);
