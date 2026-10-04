import express from "express";

import {
  getRound1Status,
  submitRound1,
} from "../controllers/studentRound1.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";


const router = express.Router();

/* =========================================================
   GET ROUND 1 STATUS
========================================================= */

router.get(
  "/hackathons/:hackathonId",
  requireAuth,
  requireRole("STUDENT"),
  getRound1Status
);


/* =========================================================
   SUBMIT ROUND 1 IDEA
========================================================= */

router.post(
  "/hackathons/:hackathonId/submit",
  requireAuth,
  requireRole("STUDENT"),
  submitRound1
);

export default router;