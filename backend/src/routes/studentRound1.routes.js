import express from "express";

import {
  getRound1Status,
  submitRound1,
  approveRound1,
  rejectRound1,
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
   Member -> proposal (PENDING_APPROVAL).
   Leader -> direct submission (SUBMITTED).
========================================================= */

router.post(
  "/hackathons/:hackathonId/submit",
  requireAuth,
  requireRole("STUDENT"),
  submitRound1
);


/* =========================================================
   APPROVE ROUND 1 PROPOSAL (team leader only)
========================================================= */

router.post(
  "/hackathons/:hackathonId/approve",
  requireAuth,
  requireRole("STUDENT"),
  approveRound1
);


/* =========================================================
   REJECT ROUND 1 PROPOSAL (team leader only)
========================================================= */

router.post(
  "/hackathons/:hackathonId/reject",
  requireAuth,
  requireRole("STUDENT"),
  rejectRound1
);

export default router;