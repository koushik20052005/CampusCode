import express from "express";

import {
  getFinalLeaderboard,
  requestResultPublication,
} from "../controllers/final.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/hackathons/:hackathonId/leaderboard",
  requireAuth,
  getFinalLeaderboard
);

router.post(
  "/hackathons/:hackathonId/request-results",
  requireAuth,
  requestResultPublication
);

export default router;