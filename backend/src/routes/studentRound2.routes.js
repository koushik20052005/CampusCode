import express from "express";

import {
  getRound2Status,
  submitRound2,
} from "../controllers/studentRound2.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// ============================================================
// GET ROUND 2 STATUS
// GET /api/student/round2/hackathons/:hackathonId
// ============================================================

router.get(
  "/hackathons/:hackathonId",
  requireAuth,
  requireRole("STUDENT"),
  getRound2Status
);

// ============================================================
// SUBMIT ROUND 2
// POST /api/student/round2/hackathons/:hackathonId/submit
// ============================================================

router.post(
  "/hackathons/:hackathonId/submit",
  requireAuth,
  requireRole("STUDENT"),
  submitRound2
);

export default router;