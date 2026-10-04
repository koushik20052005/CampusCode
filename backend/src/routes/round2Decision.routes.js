import express from "express";

import {
  decideRound2,
} from "../controllers/round2Decision.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   ORGANIZER FINAL ROUND 2 DECISION
========================================================= */

router.post(
  "/submissions/:submissionId/decision",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  decideRound2
);

export default router;