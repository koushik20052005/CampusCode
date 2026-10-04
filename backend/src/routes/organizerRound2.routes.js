import express from "express";

import {
  getRound2Submissions,
  analyzeRound2Submission,
  decideRound2Submission,
} from "../controllers/organizerRound2.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// ============================================================
// GET ALL ROUND 2 SUBMISSIONS
// GET /api/organizer/round2/hackathons/:hackathonId/submissions
// ============================================================

router.get(
  "/hackathons/:hackathonId/submissions",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  getRound2Submissions
);

// ============================================================
// AI ANALYZE ROUND 2 SUBMISSION
// POST /api/organizer/round2/submissions/:submissionId/analyze
// ============================================================

router.post(
  "/submissions/:submissionId/analyze",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  analyzeRound2Submission
);

// ============================================================
// ORGANIZER ACCEPT / REJECT
// PATCH /api/organizer/round2/submissions/:submissionId/decision
// ============================================================

router.patch(
  "/submissions/:submissionId/decision",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  decideRound2Submission
);

export default router;