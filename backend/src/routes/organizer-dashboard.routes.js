import express from "express";

import {
  getOrganizerDashboard,
} from "../controllers/organizer-dashboard.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   ORGANIZER DASHBOARD
========================================================= */

router.get(
  "/organizer",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  getOrganizerDashboard
);

export default router;