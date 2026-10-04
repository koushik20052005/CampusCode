import express from "express";

import {
  getStudentDigitalId,
  verifyStudentDigitalCard,
} from "../controllers/studentDigitalId.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();


/*
  ============================================================
  AUTHENTICATED STUDENT DIGITAL ID
  ============================================================

  GET /api/student/digital-id

  Only logged-in STUDENT users can access this.
*/
router.get(
  "/",
  requireAuth,
  requireRole("STUDENT"),
  getStudentDigitalId
);


/*
  ============================================================
  PUBLIC DIGITAL CARD VERIFICATION
  ============================================================

  GET /api/student/digital-id/public/:campusId

  This endpoint intentionally does NOT use:
    requireAuth
    requireRole

  because a person scanning the QR code may not have a
  CampusCode account or be logged in.
*/
router.get(
  "/public/:campusId",
  verifyStudentDigitalCard
);


export default router;