import express from "express";

import {
  getMonitoringHealth,
  getMonitoringStats,
  getRecentRequests,
  getMonitoringErrors,
  getResponseTimeHistory,
  getEmailQuotaStatus,
} from "../controllers/monitoring.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/*
=========================================================
CAMPUSCODE MONITORING ROUTES

ADMIN ONLY
=========================================================
*/

/*
GET SYSTEM HEALTH

/api/monitoring/health
*/

router.get(
  "/health",
  requireAuth,
  requireRole("ADMIN"),
  getMonitoringHealth
);

/*
GET MONITORING STATISTICS

/api/monitoring/stats
*/

router.get(
  "/stats",
  requireAuth,
  requireRole("ADMIN"),
  getMonitoringStats
);

/*
GET RECENT API REQUESTS

/api/monitoring/requests
*/

router.get(
  "/requests",
  requireAuth,
  requireRole("ADMIN"),
  getRecentRequests
);

/*
GET API ERRORS

/api/monitoring/errors
*/

router.get(
  "/errors",
  requireAuth,
  requireRole("ADMIN"),
  getMonitoringErrors
);

/*
GET RESPONSE TIME HISTORY

/api/monitoring/response-time
*/

router.get(
  "/response-time",
  requireAuth,
  requireRole("ADMIN"),
  getResponseTimeHistory
);

/*
GET EMAIL QUOTA — /api/monitoring/email-quota (v6.15)
*/
router.get(
  "/email-quota",
  requireAuth,
  requireRole("ADMIN"),
  getEmailQuotaStatus
);

export default router;
