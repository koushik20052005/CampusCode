import express from "express";

import {
  getStudentHackathonWorkspace,
} from "../controllers/studentWorkspace.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   GET STUDENT HACKATHON WORKSPACE
========================================================= */

router.get(
  "/hackathons/:hackathonId/workspace",
  requireAuth,
  requireRole("STUDENT"),
  getStudentHackathonWorkspace
);

export default router;