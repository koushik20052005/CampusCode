import express from "express";

import {
  getStudentProfile,
  updateStudentProfile,
} from "../controllers/studentProfile.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/",
  requireAuth,
  requireRole("STUDENT"),
  getStudentProfile
);

router.put(
  "/",
  requireAuth,
  requireRole("STUDENT"),
  updateStudentProfile
);

export default router;