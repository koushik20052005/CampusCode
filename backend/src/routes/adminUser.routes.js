import express from "express";

import {
  getAllUsers,
  getSubAdmins,
  createSubAdmin,
  createOrganizer,
  updateUserStatus,
  deleteUser,
  generateStaffTfaKey,
  removeStaffTfaKey,
} from "../controllers/adminUser.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/*
=========================================================
ADMIN AUTHORIZATION
=========================================================
*/

/*
  requireAuth:
  - Checks JWT
  - Loads user into req.user
  - Checks account is active

  requireRole("ADMIN"):
  - Allows only ADMIN users
*/

const adminOnly = requireRole("ADMIN");
const adminStaff = requireRole("ADMIN", "SUB_ADMIN");

router.get(
  "/subadmins",
  requireAuth,
  adminOnly,
  getSubAdmins
);

router.post(
  "/subadmins",
  requireAuth,
  adminOnly,
  createSubAdmin
);

router.post(
  "/organizers",
  requireAuth,
  adminOnly,
  createOrganizer
);

/*
=========================================================
GET ALL USERS
GET /api/users/admin/all
=========================================================
*/

router.get(
  "/all",
  requireAuth,
  adminStaff,
  getAllUsers
);

/*
=========================================================
BLOCK / UNBLOCK USER
PATCH /api/users/admin/:id/status
=========================================================
*/

router.patch(
  "/:id/status",
  requireAuth,
  adminStaff,
  updateUserStatus
);

/*
=========================================================
DELETE USER
DELETE /api/users/admin/:id
=========================================================
*/

router.delete(
  "/:id",
  requireAuth,
  adminStaff,
  deleteUser
);

/*
=========================================================
STAFF 2FA KEYS (v6.13, ADMIN only)
=========================================================
*/

router.post(
  "/:id/tfa-key",
  requireAuth,
  adminOnly,
  generateStaffTfaKey
);

router.delete(
  "/:id/tfa-key",
  requireAuth,
  adminOnly,
  removeStaffTfaKey
);

export default router;