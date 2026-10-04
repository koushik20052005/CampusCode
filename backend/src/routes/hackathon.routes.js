import express from "express";

/*
|--------------------------------------------------------------------------
| HACKATHON CONTROLLER
|--------------------------------------------------------------------------
*/

import {
  createHackathon,
  getHackathons,
  getOrganizerHackathons,
  getHackathonById,
  updateHackathon,
  deleteHackathon,
  updateHackathonStatus,

  submitHackathonForApproval,
  reviewHackathonApproval,
  publishHackathon,
  getPendingHackathonApprovals,

  scheduleHackathonRounds,
  getHackathonRounds,

  activateHackathonRound,
  completeHackathonRound,

  joinHackathon,
  leaveHackathon,

  getHackathonParticipants,

  createTeam,
  getHackathonTeams,
} from "../controllers/hackathon.controller.js";

/*
|--------------------------------------------------------------------------
| ROUND LIFECYCLE CONTROLLER
|--------------------------------------------------------------------------
*/

import {
  getRoundLifecycle,
  activateRound as activateLifecycleRound,
  completeRound as completeLifecycleRound,
  reopenRound as reopenLifecycleRound,
} from "../controllers/roundLifecycle.controller.js";

/*
|--------------------------------------------------------------------------
| AUTH MIDDLEWARE
|--------------------------------------------------------------------------
*/

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| HACKATHON DISCOVERY
|--------------------------------------------------------------------------
|
| GET /api/hackathons
|
*/

router.get(
  "/",
  requireAuth,
  getHackathons
);

/*
|--------------------------------------------------------------------------
| ORGANIZER - MY HACKATHONS
|--------------------------------------------------------------------------
|
| GET /api/hackathons/organizer/my-hackathons
|
*/

router.get(
  "/organizer/my-hackathons",
  requireAuth,
  requireRole("ORGANIZER"),
  getOrganizerHackathons
);

/*
|--------------------------------------------------------------------------
| ADMIN - PENDING APPROVALS
|--------------------------------------------------------------------------
|
| GET /api/hackathons/admin/pending-approvals
|
*/

router.get(
  "/admin/pending-approvals",
  requireAuth,
  requireRole("ADMIN", "SUB_ADMIN"),
  getPendingHackathonApprovals
);

/*
|--------------------------------------------------------------------------
| CREATE HACKATHON
|--------------------------------------------------------------------------
|
| POST /api/hackathons
|
*/

router.post(
  "/",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  createHackathon
);

/*
|--------------------------------------------------------------------------
| SUBMIT FOR APPROVAL
|--------------------------------------------------------------------------
|
| POST /api/hackathons/:id/submit-approval
|
*/

router.post(
  "/:id/submit-approval",
  requireAuth,
  requireRole("ORGANIZER"),
  submitHackathonForApproval
);

/*
|--------------------------------------------------------------------------
| ADMIN APPROVAL / REJECTION
|--------------------------------------------------------------------------
|
| PATCH /api/hackathons/:id/approval
|
| Body:
|
| {
|   "decision": "APPROVE",
|   "feedback": "Approved"
| }
|
*/

router.patch(
  "/:id/approval",
  requireAuth,
  requireRole("ADMIN"),
  reviewHackathonApproval
);

/*
|--------------------------------------------------------------------------
| PUBLISH HACKATHON
|--------------------------------------------------------------------------
|
| POST /api/hackathons/:id/publish
|
*/

router.post(
  "/:id/publish",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  publishHackathon
);

/*
|--------------------------------------------------------------------------
| ROUND CONFIGURATION
|--------------------------------------------------------------------------
|
| Expected dates are informational.
|
| PUT /api/hackathons/:id/rounds/schedule
|
*/

router.put(
  "/:id/rounds/schedule",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  scheduleHackathonRounds
);

/*
|--------------------------------------------------------------------------
| GET ROUND SCHEDULE
|--------------------------------------------------------------------------
|
| GET /api/hackathons/:id/rounds
|
*/

router.get(
  "/:id/rounds",
  requireAuth,
  getHackathonRounds
);

/*
|--------------------------------------------------------------------------
| NEW ROUND LIFECYCLE STATUS
|--------------------------------------------------------------------------
|
| GET /api/hackathons/:hackathonId/round-lifecycle
|
*/

router.get(
  "/:hackathonId/round-lifecycle",
  requireAuth,
  getRoundLifecycle
);

/*
|--------------------------------------------------------------------------
| NEW ROUND LIFECYCLE - ACTIVATE
|--------------------------------------------------------------------------
|
| POST
| /api/hackathons/:hackathonId/rounds/:roundNumber/lifecycle/activate
|
| Example:
|
| POST /api/hackathons/UUID/rounds/1/lifecycle/activate
|
*/

router.post(
  "/:hackathonId/rounds/:roundNumber/lifecycle/activate",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  activateLifecycleRound
);

/*
|--------------------------------------------------------------------------
| NEW ROUND LIFECYCLE - COMPLETE
|--------------------------------------------------------------------------
|
| POST
| /api/hackathons/:hackathonId/rounds/:roundNumber/lifecycle/complete
|
*/

router.post(
  "/:hackathonId/rounds/:roundNumber/lifecycle/complete",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  completeLifecycleRound
);

/*
|--------------------------------------------------------------------------
| NEW ROUND LIFECYCLE - REOPEN
|--------------------------------------------------------------------------
|
| Development/testing utility.
|
*/

router.post(
  "/:hackathonId/rounds/:roundNumber/lifecycle/reopen",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  reopenLifecycleRound
);

/*
|--------------------------------------------------------------------------
| EXISTING / COMPATIBILITY ROUND ACTIVATE
|--------------------------------------------------------------------------
|
| POST /api/hackathons/:id/rounds/:roundNumber/activate
|
| IMPORTANT:
| This uses the existing hackathon.controller function.
|
*/

router.post(
  "/:id/rounds/:roundNumber/activate",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  activateHackathonRound
);

/*
|--------------------------------------------------------------------------
| EXISTING / COMPATIBILITY ROUND COMPLETE
|--------------------------------------------------------------------------
|
| POST /api/hackathons/:id/rounds/:roundNumber/complete
|
*/

router.post(
  "/:id/rounds/:roundNumber/complete",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  completeHackathonRound
);

/*
|--------------------------------------------------------------------------
| HACKATHON STATUS
|--------------------------------------------------------------------------
|
| PATCH /api/hackathons/:id/status
|
*/

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  updateHackathonStatus
);

/*
|--------------------------------------------------------------------------
| STUDENT REGISTRATION
|--------------------------------------------------------------------------
|
| POST /api/hackathons/:id/join
|
*/

router.post(
  "/:id/join",
  requireAuth,
  joinHackathon
);

/*
|--------------------------------------------------------------------------
| STUDENT LEAVE
|--------------------------------------------------------------------------
|
| DELETE /api/hackathons/:id/leave
|
*/

router.delete(
  "/:id/leave",
  requireAuth,
  leaveHackathon
);

/*
|--------------------------------------------------------------------------
| CREATE TEAM
|--------------------------------------------------------------------------
|
| POST /api/hackathons/:id/teams
|
*/

router.post(
  "/:id/teams",
  requireAuth,
  createTeam
);

/*
|--------------------------------------------------------------------------
| GET TEAMS
|--------------------------------------------------------------------------
|
| GET /api/hackathons/:id/teams
|
*/

router.get(
  "/:id/teams",
  requireAuth,
  getHackathonTeams
);

/*
|--------------------------------------------------------------------------
| GET PARTICIPANTS
|--------------------------------------------------------------------------
|
| GET /api/hackathons/:id/participants
|
*/

router.get(
  "/:id/participants",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  getHackathonParticipants
);

/*
|--------------------------------------------------------------------------
| GET SINGLE HACKATHON
|--------------------------------------------------------------------------
|
| IMPORTANT:
| Keep this AFTER the specific routes above.
|
| GET /api/hackathons/:id
|
*/

router.get(
  "/:id",
  requireAuth,
  getHackathonById
);

/*
|--------------------------------------------------------------------------
| UPDATE HACKATHON
|--------------------------------------------------------------------------
|
| PUT /api/hackathons/:id
|
*/

router.put(
  "/:id",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  updateHackathon
);

/*
|--------------------------------------------------------------------------
| DELETE HACKATHON
|--------------------------------------------------------------------------
|
| DELETE /api/hackathons/:id
|
| Organizer:
|   Can delete own unpublished/non-live hackathon.
|
| Admin:
|   Can delete any hackathon.
|
*/

router.delete(
  "/:id",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  deleteHackathon
);

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

export default router;