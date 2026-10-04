import express from "express";

import {
  getRound3Status,
  submitRound3,
} from "../controllers/studentRound3.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// ============================================================
// STUDENT ROUND 3 ROUTES
// ============================================================

// Get Round 3 status/access/submission
router.get(
  "/hackathons/:hackathonId",
  requireAuth,
  requireRole("STUDENT"),
  getRound3Status
);

// Submit Round 3 final project
router.post(
  "/hackathons/:hackathonId/submit",
  requireAuth,
  requireRole("STUDENT"),
  submitRound3
);

export default router;