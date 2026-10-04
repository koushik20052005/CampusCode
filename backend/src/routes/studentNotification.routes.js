import express from "express";

import {
  getStudentNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/studentNotification.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/",
  requireAuth,
  requireRole("STUDENT"),
  getStudentNotifications
);

router.patch(
  "/:notificationId/read",
  requireAuth,
  requireRole("STUDENT"),
  markNotificationAsRead
);

router.patch(
  "/read-all",
  requireAuth,
  requireRole("STUDENT"),
  markAllNotificationsAsRead
);

export default router;