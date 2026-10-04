import express from "express";

import {
  getMyProject,
} from "../controllers/studentProject.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   GET MY PROJECT
========================================================= */

router.get(
  "/",
  requireAuth,
  requireRole("STUDENT"),
  getMyProject
);

export default router;