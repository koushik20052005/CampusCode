import express from "express";

import {
  requestResultPublication,
} from "../controllers/resultRequest.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   REQUEST RESULT PUBLICATION

   Organizer:
   Round 3 completed
        ↓
   Request final result publication
        ↓
   Admin reviews and approves
========================================================= */

router.post(
  "/hackathons/:hackathonId",
  requireAuth,
  requireRole("ORGANIZER"),
  requestResultPublication
);

export default router;