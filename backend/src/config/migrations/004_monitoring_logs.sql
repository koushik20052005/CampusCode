-- =========================================================
-- 004_monitoring_logs.sql
-- Table for the system-monitoring middleware, which logs
-- every API request (method, endpoint path, status code,
-- response time, user). Query strings are never stored.
-- =========================================================

CREATE TABLE IF NOT EXISTS monitoring_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    request_id UUID NOT NULL,

    method VARCHAR(10) NOT NULL,

    endpoint TEXT NOT NULL,

    status_code INTEGER NOT NULL,

    response_time_ms NUMERIC(10, 2),

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    user_role VARCHAR(20),

    error_message TEXT,

    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_logs_created_at
    ON monitoring_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_logs_endpoint
    ON monitoring_logs (endpoint);

CREATE INDEX IF NOT EXISTS idx_monitoring_logs_status_code
    ON monitoring_logs (status_code);
