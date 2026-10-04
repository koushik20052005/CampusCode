import express from "express";

import {
  createProject,
  getProjectById,
  getTeamProject,
  updateProject,
} from "../controllers/project.controller.js";

import {
  requireAuth,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   GET SINGLE PROJECT
========================================================= */

router.get(
  "/:id",
  requireAuth,
  getProjectById
);

/* =========================================================
   GET TEAM PROJECT
========================================================= */

router.get(
  "/team/:teamId",
  requireAuth,
  getTeamProject
);

/* =========================================================
   UPDATE PROJECT
========================================================= */

router.put(
  "/:id",
  requireAuth,
  updateProject
);

/* =========================================================
   CREATE PROJECT
========================================================= */

router.post(
  "/teams/:id/projects",
  requireAuth,
  createProject
);

export default router;