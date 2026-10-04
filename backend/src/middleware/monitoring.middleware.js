import crypto from "crypto";
import pool from "../config/db.js";

/*
=========================================================
CAMPUSCODE - API MONITORING MIDDLEWARE
=========================================================

Monitoring must NEVER break the actual API.

Tracks:
- Request ID
- HTTP method
- Endpoint
- Status code
- Response time
- User ID
- User role
- Errors
- User agent
=========================================================
*/

export function monitoringMiddleware(req, res, next) {
  // Only monitor API requests
  if (!req.originalUrl.startsWith("/api")) {
    return next();
  }

  // Never monitor monitoring endpoints
  // Prevents monitoring loops
  if (req.originalUrl.startsWith("/api/monitoring")) {
    return next();
  }

  const startedAt = process.hrtime.bigint();

  const requestId = crypto.randomUUID();

  req.monitoringRequestId = requestId;

  // Send request ID to frontend/Postman
  res.setHeader("X-Request-ID", requestId);

  res.on("finish", async () => {
    try {
      const endedAt = process.hrtime.bigint();

      const responseTimeMs =
        Number(endedAt - startedAt) / 1_000_000;

      const user = req.user || {};

      const errorMessage =
        req.monitoringError ||
        (res.statusCode >= 400
          ? res.statusMessage || `HTTP ${res.statusCode}`
          : null);

      await pool.query(
        `
        INSERT INTO monitoring_logs (
          request_id,
          method,
          endpoint,
          status_code,
          response_time_ms,
          user_id,
          user_role,
          error_message,
          user_agent,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          NOW()
        )
        `,
        [
          requestId,
          req.method,
          req.originalUrl,
          res.statusCode,
          Number(responseTimeMs.toFixed(2)),
          user.id || null,
          user.role || null,
          errorMessage,
          req.get("user-agent") || null,
        ]
      );
    } catch (error) {
      /*
       * Monitoring must NEVER crash or affect CampusCode.
       */

      console.error("⚠️ Monitoring log write failed:", {
        message: error?.message || "Unknown error",
        code: error?.code || "NO_CODE",
        name: error?.name || "UnknownError",
        detail: error?.detail || null,
        hint: error?.hint || null,
      });
    }
  });

  next();
}