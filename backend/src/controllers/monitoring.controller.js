import pool from "../config/db.js";

/*
=========================================================
CAMPUSCODE - MONITORING CONTROLLER
=========================================================
*/

/*
=========================================================
SYSTEM HEALTH
=========================================================
*/

export async function getMonitoringHealth(req, res) {
  const startedAt = process.hrtime.bigint();

  try {
    const dbStartedAt = process.hrtime.bigint();

    const dbResult = await pool.query(
      "SELECT NOW() AS database_time"
    );

    const dbEndedAt = process.hrtime.bigint();

    const databaseResponseMs =
      Number(dbEndedAt - dbStartedAt) / 1_000_000;

    const backendResponseMs =
      Number(process.hrtime.bigint() - startedAt) /
      1_000_000;

    res.json({
      success: true,

      system: {
        status: "OPERATIONAL",
        checked_at: new Date().toISOString(),
      },

      services: {
        backend: {
          status: "OPERATIONAL",
          response_time_ms: Number(
            backendResponseMs.toFixed(2)
          ),
          uptime_seconds: Math.floor(
            process.uptime()
          ),
        },

        database: {
          status: "CONNECTED",
          response_time_ms: Number(
            databaseResponseMs.toFixed(2)
          ),
          database_time:
            dbResult.rows[0].database_time,
        },

        ai: {
          status: process.env.GEMINI_API_KEY
            ? "CONFIGURED"
            : "NOT_CONFIGURED",
        },
      },
    });
  } catch (error) {
    console.error(
      "Monitoring health check failed:",
      error.message
    );

    res.status(503).json({
      success: false,

      system: {
        status: "DEGRADED",
        checked_at: new Date().toISOString(),
      },

      services: {
        backend: {
          status: "OPERATIONAL",
          uptime_seconds: Math.floor(
            process.uptime()
          ),
        },

        database: {
          status: "DISCONNECTED",
        },

        ai: {
          status: process.env.GEMINI_API_KEY
            ? "CONFIGURED"
            : "NOT_CONFIGURED",
        },
      },
    });
  }
}

/*
=========================================================
MONITORING STATISTICS
=========================================================
*/

export async function getMonitoringStats(req, res) {
  try {
    const result = await pool.query(`
      SELECT

        COUNT(*)::int AS total_requests,

        COUNT(*) FILTER (
          WHERE status_code BETWEEN 200 AND 399
        )::int AS successful_requests,

        COUNT(*) FILTER (
          WHERE status_code BETWEEN 400 AND 499
        )::int AS client_errors,

        COUNT(*) FILTER (
          WHERE status_code >= 500
        )::int AS server_errors,

        COALESCE(
          ROUND(
            AVG(response_time_ms)::numeric,
            2
          ),
          0
        ) AS average_response_time_ms,

        COALESCE(
          ROUND(
            PERCENTILE_CONT(0.95)
            WITHIN GROUP (
              ORDER BY response_time_ms
            )::numeric,
            2
          ),
          0
        ) AS p95_response_time_ms

      FROM monitoring_logs

      WHERE created_at >=
        NOW() - INTERVAL '24 hours'
    `);

    const lastHour = await pool.query(`
      SELECT

        COUNT(*)::int AS requests,

        COUNT(*) FILTER (
          WHERE status_code >= 400
        )::int AS errors

      FROM monitoring_logs

      WHERE created_at >=
        NOW() - INTERVAL '1 hour'
    `);

    const topErrors = await pool.query(`
      SELECT

        endpoint,

        method,

        COUNT(*)::int AS occurrences,

        MAX(created_at) AS last_seen

      FROM monitoring_logs

      WHERE status_code >= 400

      AND created_at >=
        NOW() - INTERVAL '24 hours'

      GROUP BY
        endpoint,
        method

      ORDER BY
        occurrences DESC,
        last_seen DESC

      LIMIT 10
    `);

    const row = result.rows[0];

    const total =
      Number(row.total_requests || 0);

    const successful =
      Number(row.successful_requests || 0);

    const successRate =
      total > 0
        ? Number(
            (
              (successful / total) *
              100
            ).toFixed(2)
          )
        : 100;

    res.json({
      success: true,

      period: "24h",

      stats: {
        total_requests: total,

        successful_requests:
          successful,

        client_errors:
          Number(row.client_errors || 0),

        server_errors:
          Number(row.server_errors || 0),

        success_rate:
          successRate,

        average_response_time_ms:
          Number(
            row.average_response_time_ms || 0
          ),

        p95_response_time_ms:
          Number(
            row.p95_response_time_ms || 0
          ),

        last_hour_requests:
          Number(
            lastHour.rows[0].requests || 0
          ),

        last_hour_errors:
          Number(
            lastHour.rows[0].errors || 0
          ),
      },

      top_errors:
        topErrors.rows,
    });
  } catch (error) {
    console.error(
      "Monitoring stats failed:",
      error.message
    );

    res.status(500).json({
      success: false,
      message:
        "Unable to load monitoring statistics",
    });
  }
}

/*
=========================================================
RECENT API REQUESTS
=========================================================
*/

export async function getRecentRequests(req, res) {
  try {
    const requestedLimit =
      Number(req.query.limit || 50);

    const limit = Math.min(
      Math.max(requestedLimit, 1),
      200
    );

    const result = await pool.query(
      `
      SELECT

        request_id,
        method,
        endpoint,
        status_code,
        response_time_ms,
        user_role,
        created_at

      FROM monitoring_logs

      ORDER BY
        created_at DESC

      LIMIT $1
      `,
      [limit]
    );

    res.json({
      success: true,
      requests: result.rows,
    });
  } catch (error) {
    console.error(
      "Monitoring requests failed:",
      error.message
    );

    res.status(500).json({
      success: false,
      message:
        "Unable to load recent API requests",
    });
  }
}

/*
=========================================================
ERROR LOGS
=========================================================
*/

export async function getMonitoringErrors(req, res) {
  try {
    const requestedLimit =
      Number(req.query.limit || 50);

    const limit = Math.min(
      Math.max(requestedLimit, 1),
      200
    );

    const result = await pool.query(
      `
      SELECT

        request_id,
        method,
        endpoint,
        status_code,
        response_time_ms,
        error_message,
        user_role,
        created_at

      FROM monitoring_logs

      WHERE status_code >= 400

      ORDER BY
        created_at DESC

      LIMIT $1
      `,
      [limit]
    );

    res.json({
      success: true,
      errors: result.rows,
    });
  } catch (error) {
    console.error(
      "Monitoring errors failed:",
      error.message
    );

    res.status(500).json({
      success: false,
      message:
        "Unable to load API errors",
    });
  }
}

/*
=========================================================
RESPONSE TIME HISTORY
=========================================================
*/

export async function getResponseTimeHistory(req, res) {
  try {
    const requestedMinutes =
      Number(req.query.minutes || 30);

    const minutes = Math.min(
      Math.max(requestedMinutes, 5),
      1440
    );

    const result = await pool.query(
      `
      SELECT

        date_trunc(
          'minute',
          created_at
        ) AS bucket,

        COUNT(*)::int AS requests,

        COALESCE(
          ROUND(
            AVG(response_time_ms)::numeric,
            2
          ),
          0
        ) AS average_response_time_ms,

        COALESCE(
          MAX(response_time_ms),
          0
        ) AS max_response_time_ms,

        COUNT(*) FILTER (
          WHERE status_code >= 400
        )::int AS errors

      FROM monitoring_logs

      WHERE created_at >=
        NOW() -
        ($1 * INTERVAL '1 minute')

      GROUP BY bucket

      ORDER BY bucket ASC
      `,
      [minutes]
    );

    res.json({
      success: true,
      minutes,
      history: result.rows,
    });
  } catch (error) {
    console.error(
      "Monitoring history failed:",
      error.message
    );

    res.status(500).json({
      success: false,
      message:
        "Unable to load response-time history",
    });
  }
}