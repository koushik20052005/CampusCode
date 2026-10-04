// routes/superadmin.routes.js

import express from "express";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

import {
  getSuperAdminOverview,
  getSystemHealth,
  getSystemStats,
  getLiveRequests,
  getLiveErrors,
  getResponseTime,
  getSystemBlueprint,
  getBlueprintNode,
  getMaintenanceMode,
  updateMaintenanceMode,
  getSystemActivity,
  clearTelemetry,
} from "../controllers/superadmin.controller.js";

const router = express.Router();

/*
=========================================================
SUPER ADMIN ACCESS
=========================================================

Super Admin is now part of the Admin Panel.

Both of these roles are allowed to access the Super Admin
control features:

- ADMIN
- SUPER_ADMIN

The frontend uses the normal Admin Panel layout for both.

=========================================================
*/


/* =========================================================
   OVERVIEW
   GET /api/superadmin/overview
========================================================= */

router.get(
  "/overview",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  getSuperAdminOverview
);


/* =========================================================
   SYSTEM HEALTH
   GET /api/superadmin/health
========================================================= */

router.get(
  "/health",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  getSystemHealth
);


/* =========================================================
   SYSTEM STATISTICS
   GET /api/superadmin/stats
========================================================= */

router.get(
  "/stats",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  getSystemStats
);


/* =========================================================
   LIVE REQUESTS
   GET /api/superadmin/requests
========================================================= */

router.get(
  "/requests",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  getLiveRequests
);


/* =========================================================
   LIVE ERRORS
   GET /api/superadmin/errors
========================================================= */

router.get(
  "/errors",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  getLiveErrors
);


/* =========================================================
   RESPONSE TIME
   GET /api/superadmin/response-time
========================================================= */

router.get(
  "/response-time",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  getResponseTime
);


/* =========================================================
   SYSTEM BLUEPRINT
   GET /api/superadmin/blueprint
========================================================= */

router.get(
  "/blueprint",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  getSystemBlueprint
);


/* =========================================================
   BLUEPRINT NODE
   GET /api/superadmin/blueprint/:nodeId
========================================================= */

router.get(
  "/blueprint/:nodeId",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  getBlueprintNode
);


/* =========================================================
   SYSTEM ACTIVITY
   GET /api/superadmin/activity
========================================================= */

router.get(
  "/activity",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  getSystemActivity
);


/* =========================================================
   MAINTENANCE MODE
   GET /api/superadmin/maintenance
========================================================= */

router.get(
  "/maintenance",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  getMaintenanceMode
);


/* =========================================================
   UPDATE MAINTENANCE MODE
   PATCH /api/superadmin/maintenance
========================================================= */

router.patch(
  "/maintenance",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  updateMaintenanceMode
);


/* =========================================================
   CLEAR TELEMETRY
   DELETE /api/superadmin/telemetry
========================================================= */

router.delete(
  "/telemetry",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  clearTelemetry
);


/* =========================================================
   GET TELEMETRY
   GET /api/superadmin/telemetry
========================================================= */

router.get(
  "/telemetry",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  getLiveRequests
);


export default router;