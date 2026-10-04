import express from "express";

import {
  checkIdea,
  getIdeaCheckStats,
} from "../controllers/ideacheck.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

/*
  Check a project idea
*/
router.post(
  "/check",
  requireAuth,
  checkIdea
);

/*
  Dataset statistics
*/
router.get(
  "/stats",
  requireAuth,
  getIdeaCheckStats
);

export default router;