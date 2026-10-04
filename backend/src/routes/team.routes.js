// src/routes/team.routes.js

import express from "express";

import {
  getTeamById,
  joinTeam,
  updateTeam,
  leaveTeam,
  deleteTeam,
  addMemberToTeam,
} from "../controllers/team.controller.js";

import {
  requireAuth,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   GET SINGLE TEAM

   ADMIN:
   Any team

   ORGANIZER:
   Teams belonging to their hackathon

   STUDENT:
   Only their own team
========================================================= */

router.get(
  "/:id",
  requireAuth,
  getTeamById
);

/* =========================================================
   JOIN TEAM
========================================================= */

router.post(
  "/:id/join",
  requireAuth,
  joinTeam
);

/* =========================================================
   ADD MEMBER TO TEAM - HACKMATE
========================================================= */

router.post(
  "/:teamId/members/:userId",
  requireAuth,
  addMemberToTeam
);

/* =========================================================
   UPDATE TEAM
========================================================= */

router.put(
  "/:id",
  requireAuth,
  updateTeam
);

/* =========================================================
   LEAVE TEAM
========================================================= */

router.delete(
  "/:id/leave",
  requireAuth,
  leaveTeam
);

/* =========================================================
   DELETE TEAM
========================================================= */

router.delete(
  "/:id",
  requireAuth,
  deleteTeam
);

export default router;