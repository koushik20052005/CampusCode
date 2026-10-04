import express from "express";

import {
  submitRound2,
} from "../controllers/round2.controller.js";

import {
  requireAuth,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   SUBMIT ROUND 2 PROJECT
========================================================= */

router.post(
  "/hackathons/:hackathonId/submit",
  requireAuth,
  submitRound2
);

export default router;