-- ============================================================
-- CampusCode - Round Lifecycle Update
-- PostgreSQL / Neon
-- ============================================================

BEGIN;

-- ============================================================
-- 1. HACKATHON LIFECYCLE COLUMNS
-- ============================================================

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30)
    DEFAULT 'PENDING';

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS approval_feedback TEXT;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS approved_by UUID;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS publication_status VARCHAR(30)
    DEFAULT 'DRAFT';

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS published_by UUID;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS current_round INTEGER
    DEFAULT 0;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS settings JSONB
    DEFAULT '{}'::jsonb;


-- ============================================================
-- 2. NORMALIZE EXISTING HACKATHONS
-- ============================================================

UPDATE hackathons
SET approval_status = 'PENDING'
WHERE approval_status IS NULL;

UPDATE hackathons
SET publication_status = 'DRAFT'
WHERE publication_status IS NULL;

UPDATE hackathons
SET current_round = 0
WHERE current_round IS NULL;

UPDATE hackathons
SET settings = '{}'::jsonb
WHERE settings IS NULL;


-- ============================================================
-- 3. HACKATHON ROUNDS
-- ============================================================

CREATE TABLE IF NOT EXISTS hackathon_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    round_number INTEGER NOT NULL,

    title VARCHAR(255) NOT NULL,

    start_at TIMESTAMP NOT NULL,

    end_at TIMESTAMP,

    status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',

    activated_at TIMESTAMP,

    activated_by UUID,

    completed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_hackathon_round
        UNIQUE (hackathon_id, round_number),

    CONSTRAINT valid_round_number
        CHECK (round_number IN (1, 2, 3)),

    CONSTRAINT valid_round_status
        CHECK (
            status IN (
                'SCHEDULED',
                'LIVE',
                'COMPLETED',
                'CANCELLED'
            )
        )
);


-- ============================================================
-- 4. ROUND 1 SUBMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS round1_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    submitted_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    problem_statement TEXT NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',

    ai_score NUMERIC,

    ai_analysis JSONB,

    ai_feedback TEXT,

    submitted_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_round1_team
        UNIQUE (hackathon_id, team_id),

    CONSTRAINT valid_round1_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'UNDER_REVIEW',
                'AI_ANALYZED',
                'SELECTED',
                'REJECTED'
            )
        )
);


-- ============================================================
-- 5. ROUND 1 DECISIONS
-- ============================================================
-- IMPORTANT:
-- submission_id was previously NOT NULL.
-- The new workflow uses round1_submission_id.
-- Therefore submission_id must be nullable.

ALTER TABLE round1_decisions
ALTER COLUMN submission_id DROP NOT NULL;

ALTER TABLE round1_decisions
ADD COLUMN IF NOT EXISTS round1_submission_id UUID
    REFERENCES round1_submissions(id)
    ON DELETE CASCADE;


CREATE INDEX IF NOT EXISTS idx_round1_decisions_round1_submission
ON round1_decisions(round1_submission_id);


-- ============================================================
-- 6. ROUND 2 SUBMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS round2_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    submitted_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    submission_data JSONB,

    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',

    submitted_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_round2_team
        UNIQUE (hackathon_id, team_id)
);


-- ============================================================
-- 7. ROUND 2 AI ANALYSIS
-- ============================================================

CREATE TABLE IF NOT EXISTS round2_ai_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id UUID NOT NULL
        REFERENCES round2_submissions(id)
        ON DELETE CASCADE,

    score NUMERIC,

    analysis JSONB,

    feedback TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);


-- ============================================================
-- 8. ROUND 2 DECISIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS round2_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    submission_id UUID
        REFERENCES round2_submissions(id)
        ON DELETE CASCADE,

    decision VARCHAR(30) NOT NULL,

    decided_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    organizer_feedback TEXT,

    decided_at TIMESTAMP DEFAULT NOW(),

    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_round2_decision
        UNIQUE (hackathon_id, team_id)
);


-- ============================================================
-- 9. ROUND 3 SUBMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS round3_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    submitted_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    submission_data JSONB,

    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',

    submitted_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_round3_team
        UNIQUE (hackathon_id, team_id)
);


-- ============================================================
-- 10. RESULT REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS result_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    requested_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    notes TEXT,

    requested_at TIMESTAMP DEFAULT NOW(),

    reviewed_at TIMESTAMP,

    reviewed_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL
);


-- ============================================================
-- 11. HACKATHON RULES
-- ============================================================

CREATE TABLE IF NOT EXISTS hackathon_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    round_number INTEGER,

    rules JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_hackathon_rule_round
        UNIQUE (hackathon_id, round_number)
);


-- ============================================================
-- 12. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_hackathon_rounds_hackathon
ON hackathon_rounds(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_hackathon_rounds_status
ON hackathon_rounds(status);

CREATE INDEX IF NOT EXISTS idx_round1_submissions_hackathon
ON round1_submissions(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_round1_submissions_team
ON round1_submissions(team_id);

CREATE INDEX IF NOT EXISTS idx_round1_submissions_status
ON round1_submissions(status);

CREATE INDEX IF NOT EXISTS idx_round2_submissions_hackathon
ON round2_submissions(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_round2_submissions_team
ON round2_submissions(team_id);

CREATE INDEX IF NOT EXISTS idx_round3_submissions_hackathon
ON round3_submissions(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_round3_submissions_team
ON round3_submissions(team_id);


-- ============================================================
-- 13. ROUND NUMBER / STATUS SAFETY
-- ============================================================

ALTER TABLE hackathons
ADD CONSTRAINT hackathons_current_round_check
CHECK (current_round BETWEEN 0 AND 4);


-- ============================================================
-- DONE
-- ============================================================

COMMIT;