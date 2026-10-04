import express from "express";

import {
  analyzeSubmission,
  analyzeHackathonRound1,
  getSubmissionAIAnalysis,
  decideRound1,
} from "../controllers/ai.controller.js";

import {
  requireAuth,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.post(
  "/submissions/:submissionId/analyze",
  requireAuth,
  analyzeSubmission
);

router.post(
  "/hackathons/:hackathonId/round1/analyze",
  requireAuth,
  analyzeHackathonRound1
);

router.post(
  "/submissions/:submissionId/round1/decision",
  requireAuth,
  decideRound1
);

router.get(
  "/submissions/:submissionId",
  requireAuth,
  getSubmissionAIAnalysis
);

export default router;