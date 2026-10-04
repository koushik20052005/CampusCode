import express from "express";

import {
  createTeam,
  getMyTeam,
  getMyTeammates,
} from "../controllers/studentTeam.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   CREATE TEAM
========================================================= */

router.post(
  "/hackathons/:hackathonId",
  requireAuth,
  requireRole("STUDENT"),
  createTeam
);


/* =========================================================
   MY TEAM
========================================================= */

router.get(
  "/",
  requireAuth,
  requireRole("STUDENT"),
  getMyTeam
);


/* =========================================================
   MY TEAMMATES
========================================================= */

router.get(
  "/teammates",
  requireAuth,
  requireRole("STUDENT"),
  getMyTeammates
);

export default router;