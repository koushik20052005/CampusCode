import express from "express";

import {
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteReadNotifications,
  getNotificationHistory,
  getHackathonNotificationAudience,
} from "../controllers/notification.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| USER NOTIFICATION ROUTES
|--------------------------------------------------------------------------
*/

/**
 * GET /api/notifications
 *
 * Get notifications for the currently logged-in user.
 *
 * Optional query parameters:
 * ?unread=true
 * ?limit=20
 * ?page=1
 */
router.get(
  "/",
  requireAuth,
  getNotifications
);


/**
 * GET /api/notifications/unread-count
 *
 * Get unread notification count for current user.
 */
router.get(
  "/unread-count",
  requireAuth,
  getUnreadNotificationCount
);


/**
 * PATCH /api/notifications/read-all
 *
 * Mark all notifications as read.
 */
router.patch(
  "/read-all",
  requireAuth,
  markAllNotificationsAsRead
);


/**
 * DELETE /api/notifications/read
 *
 * Delete all read notifications.
 */
router.delete(
  "/read",
  requireAuth,
  deleteReadNotifications
);


/**
 * PATCH /api/notifications/:id/read
 *
 * Mark a single notification as read.
 */
router.patch(
  "/:id/read",
  requireAuth,
  markNotificationAsRead
);


/**
 * DELETE /api/notifications/:id
 *
 * Delete a single notification.
 */
router.delete(
  "/:id",
  requireAuth,
  deleteNotification
);


/*
|--------------------------------------------------------------------------
| ADMIN / ORGANIZER NOTIFICATION MANAGEMENT
|--------------------------------------------------------------------------
*/

/**
 * POST /api/notifications
 *
 * Create and send notifications.
 *
 * ADMIN:
 * - USER
 * - SELECTED_USERS
 * - STUDENTS
 * - ORGANIZERS
 * - ALL_USERS
 * - HACKATHON_PARTICIPANTS
 *
 * ORGANIZER:
 * - USER
 * - SELECTED_USERS
 * - HACKATHON_PARTICIPANTS
 *
 * Example - single user:
 *
 * {
 *   "audience": "USER",
 *   "user_id": "USER_ID",
 *   "title": "Hackathon Update",
 *   "message": "The hackathon starts tomorrow.",
 *   "type": "ANNOUNCEMENT"
 * }
 *
 * Example - selected users:
 *
 * {
 *   "audience": "SELECTED_USERS",
 *   "user_ids": ["USER_ID_1", "USER_ID_2"],
 *   "title": "Important Update",
 *   "message": "Please check your dashboard.",
 *   "type": "INFO"
 * }
 *
 * Example - all students:
 *
 * {
 *   "audience": "STUDENTS",
 *   "title": "New Hackathon",
 *   "message": "A new hackathon is now available.",
 *   "type": "HACKATHON"
 * }
 *
 * Example - hackathon participants:
 *
 * {
 *   "audience": "HACKATHON_PARTICIPANTS",
 *   "hackathon_id": "HACKATHON_ID",
 *   "title": "Round 2",
 *   "message": "Round 2 has started.",
 *   "type": "ROUND"
 * }
 */
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "SUB_ADMIN", "ORGANIZER"),
  createNotification
);


/**
 * GET /api/notifications/history
 *
 * Admin/Organizer notification history.
 */
router.get(
  "/history",
  requireAuth,
  requireRole("ADMIN", "SUB_ADMIN", "ORGANIZER"),
  getNotificationHistory
);


/**
 * GET /api/notifications/hackathons/:hackathonId/audience
 *
 * Get participants of a hackathon.
 *
 * Used by the Organizer notification UI to allow
 * selecting specific recipients manually.
 */
router.get(
  "/hackathons/:hackathonId/audience",
  requireAuth,
  requireRole("ADMIN", "SUB_ADMIN", "ORGANIZER"),
  getHackathonNotificationAudience
);


export default router;