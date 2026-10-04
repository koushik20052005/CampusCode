import express from "express";

import {
  getRound3Submissions,
  reviewRound3Submission,
} from "../controllers/organizerRound3.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// ============================================================
// ORGANIZER ROUND 3 ROUTES
// ============================================================

// Get all Round 3 submissions
router.get(
  "/hackathons/:hackathonId/submissions",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  getRound3Submissions
);

// Review / select / reject a Round 3 submission
router.patch(
  "/submissions/:submissionId/review",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  reviewRound3Submission
);

export default router;