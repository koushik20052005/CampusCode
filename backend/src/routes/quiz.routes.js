/* =========================================================
   Quiz routes — v1 (Nov 1 quiz)
   Mounted at /api/quizzes. Organizer question management is
   ORGANIZER/ADMIN with an ownership check in the controller;
   attempts are STUDENT-only (organizers do not take quizzes).
========================================================= */

import express from "express";

import {
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  startAttempt,
  saveAnswers,
  getMyAttempt,
  submitAttempt,
  getLeaderboard,
} from "../controllers/quiz.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Organizer / admin: question bank (answers included).
router.get("/:id/questions", requireAuth, requireRole("ORGANIZER", "ADMIN"), listQuestions);
router.post("/:id/questions", requireAuth, requireRole("ORGANIZER", "ADMIN"), createQuestion);
router.patch("/:id/questions/:questionId", requireAuth, requireRole("ORGANIZER", "ADMIN"), updateQuestion);
router.delete("/:id/questions/:questionId", requireAuth, requireRole("ORGANIZER", "ADMIN"), deleteQuestion);

// Student: attempts (correct answers never sent before submit).
router.post("/:id/attempts", requireAuth, requireRole("STUDENT"), startAttempt);
router.get("/:id/attempts/mine", requireAuth, requireRole("STUDENT"), getMyAttempt);
router.put("/:id/attempts/:attemptId/answers", requireAuth, requireRole("STUDENT"), saveAnswers);
router.post("/:id/attempts/:attemptId/submit", requireAuth, requireRole("STUDENT"), submitAttempt);

// Quiz leaderboard (registered students, organizer, admin).
router.get("/:id/leaderboard", requireAuth, getLeaderboard);

export default router;
