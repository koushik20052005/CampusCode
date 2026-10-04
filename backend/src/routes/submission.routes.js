import express from "express";

import {
  createSubmission,
  getSubmissionById,
  getProjectSubmission,
  updateSubmission,
} from "../controllers/submission.controller.js";

import {
  requireAuth,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   GET PROJECT SUBMISSION
========================================================= */

router.get(
  "/project/:projectId",
  requireAuth,
  getProjectSubmission
);

/* =========================================================
   UPDATE SUBMISSION
========================================================= */

router.put(
  "/:id",
  requireAuth,
  updateSubmission
);

/* =========================================================
   GET SUBMISSION BY ID
========================================================= */

router.get(
  "/:id",
  requireAuth,
  getSubmissionById
);

/* =========================================================
   CREATE SUBMISSION
========================================================= */

router.post(
  "/projects/:projectId",
  requireAuth,
  createSubmission
);

export default router;