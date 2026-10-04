import express from "express";

import {
  analyzeRound2Submission,
} from "../controllers/round2AI.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   ANALYZE ROUND 2 SUBMISSION WITH AI
========================================================= */

router.post(
  "/submissions/:submissionId/analyze",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  analyzeRound2Submission
);

export default router;