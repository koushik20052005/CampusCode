-- ============================================================
-- CAMPUSCODE
-- DATABASE FOUNDATION MIGRATION
-- Migration: 001_complete_schema.sql
--
-- PURPOSE:
-- Synchronize the existing database with the current
-- CampusCode backend architecture.
--
-- IMPORTANT:
-- This migration DOES NOT DROP existing tables or data.
-- It uses CREATE TABLE IF NOT EXISTS and ADD COLUMN IF NOT EXISTS.
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 1. USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(120) NOT NULL,

    email VARCHAR(255) UNIQUE NOT NULL,

    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'STUDENT'
        CHECK (role IN ('STUDENT', 'ORGANIZER', 'ADMIN', 'SUB_ADMIN')),

    avatar_url TEXT,

    bio TEXT,

    skills TEXT[] DEFAULT '{}',

    campus_code_id VARCHAR(100),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Add missing columns to an existing users table

ALTER TABLE users
ADD COLUMN IF NOT EXISTS campus_code_id VARCHAR(100);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS skills TEXT[];

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE users
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- ============================================================
-- 2. HACKATHONS
-- ============================================================

CREATE TABLE IF NOT EXISTS hackathons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title VARCHAR(200) NOT NULL,

    description TEXT,

    organizer_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    track VARCHAR(100) NOT NULL,

    location VARCHAR(200),

    start_date TIMESTAMPTZ,

    end_date TIMESTAMPTZ,

    registration_deadline TIMESTAMPTZ,

    max_teams INTEGER DEFAULT 100,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',

    approval_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',

    approval_feedback TEXT,

    approved_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    approved_at TIMESTAMPTZ,

    publication_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',

    published_at TIMESTAMPTZ,

    published_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    current_round INTEGER NOT NULL DEFAULT 0,

    settings JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Add lifecycle columns to an existing hackathons table

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20);

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS approval_feedback TEXT;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS approved_by UUID;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS publication_status VARCHAR(20);

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS published_by UUID;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS current_round INTEGER;

ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS settings JSONB;


-- Defaults for existing rows

UPDATE hackathons
SET approval_status = COALESCE(approval_status, 'DRAFT')
WHERE approval_status IS NULL;

UPDATE hackathons
SET publication_status = COALESCE(publication_status, 'DRAFT')
WHERE publication_status IS NULL;

UPDATE hackathons
SET current_round = COALESCE(current_round, 0)
WHERE current_round IS NULL;

UPDATE hackathons
SET settings = COALESCE(settings, '{}'::jsonb)
WHERE settings IS NULL;


ALTER TABLE hackathons
ALTER COLUMN approval_status SET DEFAULT 'DRAFT';

ALTER TABLE hackathons
ALTER COLUMN publication_status SET DEFAULT 'DRAFT';

ALTER TABLE hackathons
ALTER COLUMN current_round SET DEFAULT 0;

ALTER TABLE hackathons
ALTER COLUMN settings SET DEFAULT '{}'::jsonb;


-- Foreign keys for lifecycle users

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'hackathons_approved_by_fkey'
    ) THEN
        ALTER TABLE hackathons
        ADD CONSTRAINT hackathons_approved_by_fkey
        FOREIGN KEY (approved_by)
        REFERENCES users(id)
        ON DELETE SET NULL;
    END IF;
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'hackathons_published_by_fkey'
    ) THEN
        ALTER TABLE hackathons
        ADD CONSTRAINT hackathons_published_by_fkey
        FOREIGN KEY (published_by)
        REFERENCES users(id)
        ON DELETE SET NULL;
    END IF;
END $$;


-- ============================================================
-- 3. HACKATHON PARTICIPANTS
-- ============================================================

CREATE TABLE IF NOT EXISTS hackathon_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED',

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hackathon_id, user_id)
);


-- ============================================================
-- 4. TEAMS
-- ============================================================

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    name VARCHAR(150) NOT NULL,

    leader_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    status VARCHAR(20) NOT NULL DEFAULT 'BUILDING',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hackathon_id, name)
);


-- ============================================================
-- 5. TEAM MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role VARCHAR(50) DEFAULT 'MEMBER',

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (team_id, user_id)
);


-- ============================================================
-- 6. PROJECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    title VARCHAR(200) NOT NULL,

    track VARCHAR(100),

    problem_statement TEXT,

    solution TEXT,

    technologies TEXT[] DEFAULT '{}',

    github_url TEXT,

    live_demo_url TEXT,

    completion_percentage INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (team_id)
);


-- ============================================================
-- 7. SUBMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,

    submitted_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',

    submitted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (project_id)
);


-- ============================================================
-- 8. EVALUATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id UUID NOT NULL
        REFERENCES submissions(id)
        ON DELETE CASCADE,

    evaluator_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    problem_relevance INTEGER DEFAULT 0,

    innovation INTEGER DEFAULT 0,

    technical_depth INTEGER DEFAULT 0,

    impact INTEGER DEFAULT 0,

    overall_score NUMERIC(5,2) DEFAULT 0,

    feedback TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 9. OLD / GENERAL AI ANALYSIS
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id UUID NOT NULL
        REFERENCES submissions(id)
        ON DELETE CASCADE,

    novelty_score INTEGER,

    relevance_score INTEGER,

    innovation_score INTEGER,

    technical_score INTEGER,

    impact_score INTEGER,

    feedback TEXT,

    model_name VARCHAR(100) DEFAULT 'CampusCode Mock AI',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 10. HACKATHON ROUNDS
-- ============================================================

CREATE TABLE IF NOT EXISTS hackathon_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    round_number INTEGER NOT NULL,

    title VARCHAR(200) NOT NULL,

    start_at TIMESTAMPTZ,

    end_at TIMESTAMPTZ,

    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',

    activated_at TIMESTAMPTZ,

    activated_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    completed_at TIMESTAMPTZ,

    completed_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hackathon_id, round_number)
);


-- ============================================================
-- 11. ROUND 1 SUBMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS round1_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    submitted_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    problem_statement TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',

    ai_score NUMERIC(5,2),

    submitted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hackathon_id, team_id)
);


-- ============================================================
-- 12. ROUND 1 DECISIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS round1_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    submission_id UUID NOT NULL
        REFERENCES round1_submissions(id)
        ON DELETE CASCADE,

    decision VARCHAR(20) NOT NULL
        CHECK (decision IN ('SELECTED', 'REJECTED')),

    decided_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    organizer_feedback TEXT,

    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hackathon_id, team_id)
);


-- ============================================================
-- 13. ROUND 2 SUBMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS round2_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    submitted_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    github_url TEXT,

    pdf_url TEXT,

    pdf_file_name TEXT,

    pdf_file_path TEXT,

    extracted_text TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',

    submitted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hackathon_id, team_id)
);


-- Existing database upgrades for Round 2

ALTER TABLE round2_submissions
ADD COLUMN IF NOT EXISTS pdf_file_name TEXT;

ALTER TABLE round2_submissions
ADD COLUMN IF NOT EXISTS pdf_file_path TEXT;

ALTER TABLE round2_submissions
ADD COLUMN IF NOT EXISTS extracted_text TEXT;


-- ============================================================
-- 14. ROUND 2 AI ANALYSIS
-- ============================================================

CREATE TABLE IF NOT EXISTS round2_ai_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    round2_submission_id UUID NOT NULL
        REFERENCES round2_submissions(id)
        ON DELETE CASCADE,

    novelty_score INTEGER
        CHECK (novelty_score BETWEEN 0 AND 100),

    relevance_score INTEGER
        CHECK (relevance_score BETWEEN 0 AND 100),

    innovation_score INTEGER
        CHECK (innovation_score BETWEEN 0 AND 100),

    technical_score INTEGER
        CHECK (technical_score BETWEEN 0 AND 100),

    impact_score INTEGER
        CHECK (impact_score BETWEEN 0 AND 100),

    overall_score NUMERIC(5,2),

    recommendation VARCHAR(20),

    feedback TEXT,

    strengths TEXT[],

    weaknesses TEXT[],

    suggestions TEXT[],

    model_name VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (round2_submission_id)
);


-- ============================================================
-- 15. ROUND 2 DECISIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS round2_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    round2_submission_id UUID NOT NULL
        REFERENCES round2_submissions(id)
        ON DELETE CASCADE,

    decision VARCHAR(20) NOT NULL
        CHECK (decision IN ('SELECTED', 'REJECTED')),

    decided_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    organizer_feedback TEXT,

    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hackathon_id, team_id)
);


-- ============================================================
-- 16. ROUND 3 SUBMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS round3_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    submitted_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    github_url TEXT,

    demo_url TEXT,

    project_description TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',

    submitted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hackathon_id, team_id)
);


-- ============================================================
-- 17. RESULT REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS result_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    requested_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED'
            )
        ),

    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    reviewed_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ,

    admin_feedback TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 18. HACKATHON RULES / RULEBOT
-- ============================================================

CREATE TABLE IF NOT EXISTS hackathon_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    file_name TEXT NOT NULL,

    file_path TEXT NOT NULL,

    extracted_text TEXT,

    uploaded_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hackathon_id)
);


-- ============================================================
-- 19. NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    title VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    type VARCHAR(50) DEFAULT 'GENERAL',

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 20. INDEXES — USERS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_campus_code
ON users(campus_code_id);


-- ============================================================
-- 21. INDEXES — HACKATHONS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_hackathons_organizer
ON hackathons(organizer_id);

CREATE INDEX IF NOT EXISTS idx_hackathons_status
ON hackathons(status);

CREATE INDEX IF NOT EXISTS idx_hackathons_approval_status
ON hackathons(approval_status);

CREATE INDEX IF NOT EXISTS idx_hackathons_publication_status
ON hackathons(publication_status);

CREATE INDEX IF NOT EXISTS idx_hackathons_current_round
ON hackathons(current_round);


-- ============================================================
-- 22. INDEXES — PARTICIPANTS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_participants_hackathon
ON hackathon_participants(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_participants_user
ON hackathon_participants(user_id);


-- ============================================================
-- 23. INDEXES — TEAMS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_teams_hackathon
ON teams(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_teams_leader
ON teams(leader_id);


-- ============================================================
-- 24. INDEXES — TEAM MEMBERS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_team_members_team
ON team_members(team_id);

CREATE INDEX IF NOT EXISTS idx_team_members_user
ON team_members(user_id);


-- ============================================================
-- 25. INDEXES — PROJECTS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_projects_team
ON projects(team_id);


-- ============================================================
-- 26. INDEXES — SUBMISSIONS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_submissions_project
ON submissions(project_id);

CREATE INDEX IF NOT EXISTS idx_submissions_submitted_by
ON submissions(submitted_by);


-- ============================================================
-- 27. INDEXES — EVALUATIONS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_evaluations_submission
ON evaluations(submission_id);

CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator
ON evaluations(evaluator_id);


-- ============================================================
-- 28. INDEXES — AI ANALYSIS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ai_analysis_submission
ON ai_analysis(submission_id);


-- ============================================================
-- 29. INDEXES — HACKATHON ROUNDS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_rounds_hackathon
ON hackathon_rounds(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_rounds_status
ON hackathon_rounds(status);

CREATE INDEX IF NOT EXISTS idx_rounds_number
ON hackathon_rounds(round_number);


-- ============================================================
-- 30. INDEXES — ROUND 1
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_round1_submissions_hackathon
ON round1_submissions(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_round1_submissions_team
ON round1_submissions(team_id);

CREATE INDEX IF NOT EXISTS idx_round1_decisions_hackathon
ON round1_decisions(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_round1_decisions_team
ON round1_decisions(team_id);

CREATE INDEX IF NOT EXISTS idx_round1_decisions_submission
ON round1_decisions(submission_id);


-- ============================================================
-- 31. INDEXES — ROUND 2
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_round2_submissions_hackathon
ON round2_submissions(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_round2_submissions_team
ON round2_submissions(team_id);

CREATE INDEX IF NOT EXISTS idx_round2_submissions_status
ON round2_submissions(status);

CREATE INDEX IF NOT EXISTS idx_round2_ai_submission
ON round2_ai_analysis(round2_submission_id);

CREATE INDEX IF NOT EXISTS idx_round2_decisions_hackathon
ON round2_decisions(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_round2_decisions_team
ON round2_decisions(team_id);

CREATE INDEX IF NOT EXISTS idx_round2_decisions_submission
ON round2_decisions(round2_submission_id);


-- ============================================================
-- 32. INDEXES — ROUND 3
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_round3_submissions_hackathon
ON round3_submissions(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_round3_submissions_team
ON round3_submissions(team_id);

CREATE INDEX IF NOT EXISTS idx_round3_submissions_status
ON round3_submissions(status);


-- ============================================================
-- 33. INDEXES — RESULT REQUESTS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_result_requests_hackathon
ON result_requests(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_result_requests_requested_by
ON result_requests(requested_by);

CREATE INDEX IF NOT EXISTS idx_result_requests_status
ON result_requests(status);


-- ============================================================
-- 34. INDEXES — RULEBOT
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_hackathon_rules_hackathon
ON hackathon_rules(hackathon_id);


-- ============================================================
-- 35. INDEXES — NOTIFICATIONS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user
ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
ON notifications(user_id, is_read);


-- ============================================================
-- 36. UPDATED_AT HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION campuscode_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ============================================================
-- 37. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION campuscode_set_updated_at();


DROP TRIGGER IF EXISTS trg_hackathons_updated_at ON hackathons;

CREATE TRIGGER trg_hackathons_updated_at
BEFORE UPDATE ON hackathons
FOR EACH ROW
EXECUTE FUNCTION campuscode_set_updated_at();


DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;

CREATE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON teams
FOR EACH ROW
EXECUTE FUNCTION campuscode_set_updated_at();


DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;

CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION campuscode_set_updated_at();


DROP TRIGGER IF EXISTS trg_submissions_updated_at ON submissions;

CREATE TRIGGER trg_submissions_updated_at
BEFORE UPDATE ON submissions
FOR EACH ROW
EXECUTE FUNCTION campuscode_set_updated_at();


DROP TRIGGER IF EXISTS trg_evaluations_updated_at ON evaluations;

CREATE TRIGGER trg_evaluations_updated_at
BEFORE UPDATE ON evaluations
FOR EACH ROW
EXECUTE FUNCTION campuscode_set_updated_at();


DROP TRIGGER IF EXISTS trg_hackathon_rounds_updated_at
ON hackathon_rounds;

CREATE TRIGGER trg_hackathon_rounds_updated_at
BEFORE UPDATE ON hackathon_rounds
FOR EACH ROW
EXECUTE FUNCTION campuscode_set_updated_at();


DROP TRIGGER IF EXISTS trg_round1_submissions_updated_at
ON round1_submissions;

CREATE TRIGGER trg_round1_submissions_updated_at
BEFORE UPDATE ON round1_submissions
FOR EACH ROW
EXECUTE FUNCTION campuscode_set_updated_at();


DROP TRIGGER IF EXISTS trg_round2_submissions_updated_at
ON round2_submissions;

CREATE TRIGGER trg_round2_submissions_updated_at
BEFORE UPDATE ON round2_submissions
FOR EACH ROW
EXECUTE FUNCTION campuscode_set_updated_at();


DROP TRIGGER IF EXISTS trg_round2_ai_analysis_updated_at
ON round2_ai_analysis;

CREATE TRIGGER trg_round2_ai_analysis_updated_at
BEFORE UPDATE ON round2_ai_analysis
FOR EACH ROW
EXECUTE FUNCTION campuscode_set_updated_at();


DROP TRIGGER IF EXISTS trg_round3_submissions_updated_at
ON round3_submissions;

CREATE TRIGGER trg_round3_submissions_updated_at
BEFORE UPDATE ON round3_submissions
FOR EACH ROW
EXECUTE FUNCTION campuscode_set_updated_at();


DROP TRIGGER IF EXISTS trg_result_requests_updated_at
ON result_requests;

CREATE TRIGGER trg_result_requests_updated_at
BEFORE UPDATE ON result_requests
FOR EACH ROW
EXECUTE FUNCTION campuscode_set_updated_at();


DROP TRIGGER IF EXISTS trg_hackathon_rules_updated_at
ON hackathon_rules;

CREATE TRIGGER trg_hackathon_rules_updated_at
BEFORE UPDATE ON hackathon_rules
FOR EACH ROW
EXECUTE FUNCTION campuscode_set_updated_at();


-- ============================================================
-- 38. FINAL VERIFICATION
-- ============================================================

SELECT
    'users' AS table_name,
    COUNT(*) AS row_count
FROM users

UNION ALL

SELECT
    'hackathons',
    COUNT(*)
FROM hackathons

UNION ALL

SELECT
    'hackathon_participants',
    COUNT(*)
FROM hackathon_participants

UNION ALL

SELECT
    'teams',
    COUNT(*)
FROM teams

UNION ALL

SELECT
    'team_members',
    COUNT(*)
FROM team_members

UNION ALL

SELECT
    'projects',
    COUNT(*)
FROM projects

UNION ALL

SELECT
    'submissions',
    COUNT(*)
FROM submissions

UNION ALL

SELECT
    'hackathon_rounds',
    COUNT(*)
FROM hackathon_rounds

UNION ALL

SELECT
    'round1_submissions',
    COUNT(*)
FROM round1_submissions

UNION ALL

SELECT
    'round1_decisions',
    COUNT(*)
FROM round1_decisions

UNION ALL

SELECT
    'round2_submissions',
    COUNT(*)
FROM round2_submissions

UNION ALL

SELECT
    'round2_ai_analysis',
    COUNT(*)
FROM round2_ai_analysis

UNION ALL

SELECT
    'round2_decisions',
    COUNT(*)
FROM round2_decisions

UNION ALL

SELECT
    'round3_submissions',
    COUNT(*)
FROM round3_submissions

UNION ALL

SELECT
    'result_requests',
    COUNT(*)
FROM result_requests

UNION ALL

SELECT
    'hackathon_rules',
    COUNT(*)
FROM hackathon_rules

UNION ALL

SELECT
    'notifications',
    COUNT(*)
FROM notifications

ORDER BY table_name;


-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================