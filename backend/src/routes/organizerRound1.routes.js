import express from "express";

import {
  getRound1Submissions,
  getRound1Submission,
  analyzeRound1Submission,
  decideRound1,
  getRound1Decision,
  saveRound1FeedbackDraft,
} from "../controllers/organizerRound1.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();


/* =========================================================
   GET ALL ROUND 1 SUBMISSIONS
========================================================= */

router.get(
  "/hackathons/:hackathonId/submissions",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  getRound1Submissions
);


/* =========================================================
   GET ONE ROUND 1 SUBMISSION
========================================================= */

router.get(
  "/submissions/:submissionId",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  getRound1Submission
);


/* =========================================================
   GEMINI AI ANALYSIS
========================================================= */

router.post(
  "/submissions/:submissionId/analyze",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  analyzeRound1Submission
);


/* =========================================================
   ACCEPT / REJECT
========================================================= */

router.patch(
  "/submissions/:submissionId/decision",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  decideRound1
);

router.patch(
  "/submissions/:submissionId/feedback",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  saveRound1FeedbackDraft
);


/* =========================================================
   GET DECISION
========================================================= */

router.get(
  "/hackathons/:hackathonId/teams/:teamId/decision",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  getRound1Decision
);


export default router;