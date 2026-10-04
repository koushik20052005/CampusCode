import express from "express";

import {
  getMyProfile,
  getPublicProfile,
  updateMyProfile,
  getAllUsers,
} from "../controllers/user.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================================================
   MY PROFILE
========================================================= */

router.get(
  "/me",
  requireAuth,
  getMyProfile
);

/* =========================================================
   PUBLIC DIGITAL ID PROFILE
========================================================= */

router.get(
  "/public/:campusCodeId",
  getPublicProfile
);

/* =========================================================
   UPDATE MY PROFILE
========================================================= */

router.put(
  "/me",
  requireAuth,
  updateMyProfile
);

/* =========================================================
   ADMIN — GET ALL USERS
========================================================= */

router.get(
  "/admin/all",
  requireAuth,
  requireRole("ADMIN"),
  getAllUsers
);

export default router;