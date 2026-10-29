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
  reportProctor,
  getMyAttempt,
  submitAttempt,
  getLeaderboard,
  listSubmissions,
  stopQuiz,
  postResults,
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

// Quiz Manager (organizer/admin): submissions with marks + proctor
// flags, stop, and per-student result posting.
router.get("/:id/submissions", requireAuth, requireRole("ORGANIZER", "ADMIN"), listSubmissions);
router.post("/:id/stop", requireAuth, requireRole("ORGANIZER", "ADMIN"), stopQuiz);
router.post("/:id/post-results", requireAuth, requireRole("ORGANIZER", "ADMIN"), postResults);

// Student: attempts (correct answers never sent; score only after
// the organizer posts that student's result).
router.post("/:id/attempts", requireAuth, requireRole("STUDENT"), startAttempt);
router.get("/:id/attempts/mine", requireAuth, requireRole("STUDENT"), getMyAttempt);
router.put("/:id/attempts/:attemptId/answers", requireAuth, requireRole("STUDENT"), saveAnswers);
router.put("/:id/attempts/:attemptId/proctor", requireAuth, requireRole("STUDENT"), reportProctor);
router.post("/:id/attempts/:attemptId/submit", requireAuth, requireRole("STUDENT"), submitAttempt);

// Quiz leaderboard (registered students, organizer, admin).
router.get("/:id/leaderboard", requireAuth, getLeaderboard);

export default router;
