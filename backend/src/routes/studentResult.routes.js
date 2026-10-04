import express from "express";

import {
  getStudentResults,
} from "../controllers/studentResult.controller.js";

import {
  requireAuth,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/:hackathonId",
  requireAuth,
  getStudentResults
);

export default router;