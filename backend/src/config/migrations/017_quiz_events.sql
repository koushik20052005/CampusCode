-- ============================================================
-- 017 — Quiz events (Nov 1 quiz, v1)
-- A quiz is a hackathons row with event_type = 'quiz'. It reuses
-- the existing approval pipeline (submit → admin approve →
-- publish → OPEN) and the participant registration flow.
-- Quiz-only data lives in the two tables below. Quiz settings
-- (duration, negative marking, participant cap) live in the
-- hackathons.settings JSONB column that already exists.
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE hackathons
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(20)
    NOT NULL DEFAULT 'hackathon'
    CHECK (event_type IN ('hackathon', 'quiz'));

CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    question_text TEXT NOT NULL,

    question_type VARCHAR(20) NOT NULL
        CHECK (question_type IN ('MCQ', 'TRUE_FALSE')),

    -- MCQ: 2-6 option strings. TRUE_FALSE: always ['True', 'False'].
    options JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Index into options. Never sent to students.
    correct_index INTEGER NOT NULL,

    marks INTEGER NOT NULL DEFAULT 1
        CHECK (marks >= 1),

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_hackathon
    ON quiz_questions (hackathon_id, sort_order, id);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hackathon_id UUID NOT NULL
        REFERENCES hackathons(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
        CHECK (status IN ('IN_PROGRESS', 'SUBMITTED')),

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,

    score NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_marks INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    question_count INTEGER NOT NULL DEFAULT 0,

    -- { question_id: selected_option_index }
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,

    UNIQUE (hackathon_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_hackathon
    ON quiz_attempts (hackathon_id, score DESC, submitted_at ASC NULLS LAST);
