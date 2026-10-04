-- ============================================================
-- CAMPUSCODE ADMIN / SUB-ADMIN ROLE MIGRATION
-- Run after 001_complete_schema.sql and any older role migrations.
-- ============================================================

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('STUDENT', 'ORGANIZER', 'ADMIN', 'SUB_ADMIN'));

CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);

-- Convert any legacy Super Admin accounts to the single top-level ADMIN role.
UPDATE users SET role = 'ADMIN' WHERE role = 'SUPER_ADMIN';
