import express from "express";

import {
  getPendingResultRequests,
  approveResultRequest,
  rejectResultRequest,
} from "../controllers/adminResultRequest.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   GET PENDING RESULT REQUESTS
========================================================= */

router.get(
  "/pending",
  requireAuth,
  requireRole("ADMIN"),
  getPendingResultRequests
);

/* =========================================================
   APPROVE RESULT REQUEST
========================================================= */

router.post(
  "/:requestId/approve",
  requireAuth,
  requireRole("ADMIN"),
  approveResultRequest
);

/* =========================================================
   REJECT RESULT REQUEST
========================================================= */

router.post(
  "/:requestId/reject",
  requireAuth,
  requireRole("ADMIN"),
  rejectResultRequest
);

export default router;