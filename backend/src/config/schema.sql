-- =========================================================
-- CAMPUSCODE DATABASE SCHEMA
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- USERS
-- =========================================================

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

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- HACKATHONS
-- =========================================================

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

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'OPEN',
                'LIVE',
                'PAUSED',
                'COMPLETED'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- HACKATHON PARTICIPANTS
-- =========================================================

CREATE TABLE IF NOT EXISTS hackathon_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED'
        CHECK (
            status IN (
                'REGISTERED',
                'ACTIVE',
                'WITHDRAWN'
            )
        ),

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hackathon_id, user_id)
);

-- =========================================================
-- TEAMS
-- =========================================================

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    name VARCHAR(150) NOT NULL,

    leader_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    status VARCHAR(20) NOT NULL DEFAULT 'BUILDING'
        CHECK (
            status IN (
                'BUILDING',
                'SUBMITTED',
                'FINALIST',
                'WINNER',
                'DISQUALIFIED'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hackathon_id, name)
);

-- =========================================================
-- TEAM MEMBERS
-- =========================================================

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

-- =========================================================
-- PROJECTS
-- =========================================================

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

    completion_percentage INTEGER DEFAULT 0
        CHECK (
            completion_percentage >= 0
            AND completion_percentage <= 100
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (team_id)
);

-- =========================================================
-- SUBMISSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,

    submitted_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'UNDER_REVIEW',
                'REVIEWED',
                'REJECTED'
            )
        ),

    submitted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (project_id)
);

-- =========================================================
-- EVALUATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id UUID NOT NULL
        REFERENCES submissions(id)
        ON DELETE CASCADE,

    evaluator_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    problem_relevance INTEGER DEFAULT 0
        CHECK (
            problem_relevance BETWEEN 0 AND 100
        ),

    innovation INTEGER DEFAULT 0
        CHECK (
            innovation BETWEEN 0 AND 100
        ),

    technical_depth INTEGER DEFAULT 0
        CHECK (
            technical_depth BETWEEN 0 AND 100
        ),

    impact INTEGER DEFAULT 0
        CHECK (
            impact BETWEEN 0 AND 100
        ),

    overall_score NUMERIC(5,2) DEFAULT 0,

    feedback TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'IN_PROGRESS',
                'COMPLETED'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- AI ANALYSIS
-- =========================================================

CREATE TABLE IF NOT EXISTS ai_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id UUID NOT NULL
        REFERENCES submissions(id)
        ON DELETE CASCADE,

    novelty_score INTEGER
        CHECK (
            novelty_score BETWEEN 0 AND 100
        ),

    relevance_score INTEGER
        CHECK (
            relevance_score BETWEEN 0 AND 100
        ),

    innovation_score INTEGER
        CHECK (
            innovation_score BETWEEN 0 AND 100
        ),

    technical_score INTEGER
        CHECK (
            technical_score BETWEEN 0 AND 100
        ),

    impact_score INTEGER
        CHECK (
            impact_score BETWEEN 0 AND 100
        ),

    feedback TEXT,

    model_name VARCHAR(100) DEFAULT 'CampusCode Mock AI',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- ROUND 1 DECISIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS round1_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    team_id UUID NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

    submission_id UUID NOT NULL
        REFERENCES submissions(id)
        ON DELETE CASCADE,

    decision VARCHAR(20) NOT NULL
        CHECK (
            decision IN (
                'SELECTED',
                'REJECTED'
            )
        ),

    decided_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    organizer_feedback TEXT,

    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (hackathon_id, team_id)
);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_round1_decisions_hackathon
ON round1_decisions(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_round1_decisions_team
ON round1_decisions(team_id);

CREATE INDEX IF NOT EXISTS idx_round1_decisions_submission
ON round1_decisions(submission_id);

CREATE INDEX IF NOT EXISTS idx_round1_decisions_decided_by
ON round1_decisions(decided_by);
-- =========================================================
-- NOTIFICATIONS
-- =========================================================

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

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

CREATE INDEX IF NOT EXISTS idx_hackathons_organizer
ON hackathons(organizer_id);

CREATE INDEX IF NOT EXISTS idx_hackathons_status
ON hackathons(status);

CREATE INDEX IF NOT EXISTS idx_participants_hackathon
ON hackathon_participants(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_participants_user
ON hackathon_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_teams_hackathon
ON teams(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_team_members_team
ON team_members(team_id);

CREATE INDEX IF NOT EXISTS idx_team_members_user
ON team_members(user_id);

CREATE INDEX IF NOT EXISTS idx_projects_team
ON projects(team_id);

CREATE INDEX IF NOT EXISTS idx_submissions_project
ON submissions(project_id);

CREATE INDEX IF NOT EXISTS idx_evaluations_submission
ON evaluations(submission_id);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_submission
ON ai_analysis(submission_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user
ON notifications(user_id);

-- =========================================================
-- DONE
-- =========================================================