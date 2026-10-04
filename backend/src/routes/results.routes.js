import express from "express";

import {
  getHackathonResults,
  publishHackathonResults,
} from "../controllers/results.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();


/* =========================================================
   GET HACKATHON RESULTS
========================================================= */

router.get(
  "/hackathon/:hackathonId",
  requireAuth,
  getHackathonResults
);


/* =========================================================
   PUBLISH HACKATHON RESULTS
========================================================= */

router.post(
  "/hackathon/:hackathonId/publish",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  publishHackathonResults
);


export default router;