import express from "express";

import {
  getAdminDashboard,
} from "../controllers/admin-dashboard.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * GET /api/dashboard/admin
 * Admin dashboard overview and statistics
 *
 * Authentication:
 * - User must have a valid JWT
 * - User must have ADMIN role
 */
router.get(
  "/admin",
  requireAuth,
  requireRole("ADMIN", "SUB_ADMIN"),
  getAdminDashboard
);

export default router;