// src/routes/team.routes.js

import express from "express";

import {
  getTeamById,
  joinTeam,
  updateTeam,
  leaveTeam,
  deleteTeam,
  inviteMemberToTeam,
  listTeamInvites,
  listMyInvites,
  acceptTeamInvite,
  declineTeamInvite,
  cancelTeamInvite,
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
   TEAM INVITES — invite-by-CC-ID + accept/decline (v6.56)
   Replaces the old silent direct-add. The leader invites,
   the invitee accepts before joining.
========================================================= */

router.post(
  "/:teamId/invite",
  requireAuth,
  inviteMemberToTeam
);

router.get(
  "/:teamId/invites",
  requireAuth,
  listTeamInvites
);

router.get(
  "/invites/mine",
  requireAuth,
  listMyInvites
);

router.post(
  "/invites/:inviteId/accept",
  requireAuth,
  acceptTeamInvite
);

router.post(
  "/invites/:inviteId/decline",
  requireAuth,
  declineTeamInvite
);

router.post(
  "/invites/:inviteId/cancel",
  requireAuth,
  cancelTeamInvite
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