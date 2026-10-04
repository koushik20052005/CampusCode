import express from "express";

import {
  getFinalLeaderboard,
} from "../controllers/leaderboard.controller.js";

import {
  requireAuth,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   GET FINAL LEADERBOARD

   Accessible by:
   - STUDENT
   - ORGANIZER
   - ADMIN

   The controller handles the detailed authorization:
   - ADMIN → any hackathon
   - ORGANIZER → own hackathon
   - STUDENT → registered participant
========================================================= */

router.get(
  "/hackathons/:hackathonId",
  requireAuth,
  getFinalLeaderboard
);

export default router;