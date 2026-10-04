import express from "express";

import {
  getAvailableHackathons,
  registerForHackathon,
  getMyHackathons,
  getMyHackathonById,
} from "../controllers/studentHackathon.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();


/* =========================================================
   AVAILABLE HACKATHONS

   GET
   /api/student/hackathons
========================================================= */

router.get(
  "/",
  requireAuth,
  requireRole("STUDENT"),
  getAvailableHackathons
);


/* =========================================================
   MY HACKATHONS

   GET
   /api/student/hackathons/my-hackathons
========================================================= */

router.get(
  "/my-hackathons",
  requireAuth,
  requireRole("STUDENT"),
  getMyHackathons
);


/* =========================================================
   REGISTER FOR HACKATHON

   POST
   /api/student/hackathons/:hackathonId/register
========================================================= */

router.post(
  "/:hackathonId/register",
  requireAuth,
  requireRole("STUDENT"),
  registerForHackathon
);


/* =========================================================
   GET MY SINGLE HACKATHON

   GET
   /api/student/hackathons/:hackathonId
========================================================= */

router.get(
  "/:hackathonId",
  requireAuth,
  requireRole("STUDENT"),
  getMyHackathonById
);


export default router;