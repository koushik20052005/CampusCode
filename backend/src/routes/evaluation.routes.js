import express from "express";

import {
  createEvaluation,
  getEvaluationById,
  getSubmissionEvaluations,
  updateEvaluation,
  deleteEvaluation,
} from "../controllers/evaluation.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   GET ALL EVALUATIONS FOR SUBMISSION
========================================================= */

router.get(
  "/submission/:submissionId",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN", "SUB_ADMIN"),
  getSubmissionEvaluations
);

/* =========================================================
   GET EVALUATION BY ID
========================================================= */

router.get(
  "/:id",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN", "SUB_ADMIN"),
  getEvaluationById
);

/* =========================================================
   CREATE EVALUATION
========================================================= */

router.post(
  "/",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN", "SUB_ADMIN"),
  createEvaluation
);

/* =========================================================
   UPDATE EVALUATION
========================================================= */

router.put(
  "/:id",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN", "SUB_ADMIN"),
  updateEvaluation
);

/* =========================================================
   DELETE EVALUATION
========================================================= */

router.delete(
  "/:id",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN", "SUB_ADMIN"),
  deleteEvaluation
);

export default router;