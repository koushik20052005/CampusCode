import express from "express";

import {
  evaluateRound3,
} from "../controllers/round3.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   ROUND 3 FINAL EVALUATION
========================================================= */

router.post(
  "/hackathons/:hackathonId/teams/:teamId/evaluate",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  evaluateRound3
);

export default router;