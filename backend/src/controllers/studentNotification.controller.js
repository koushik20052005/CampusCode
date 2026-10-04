import pool from "../config/db.js";

/*
  GET STUDENT NOTIFICATIONS

  GET /api/student/notifications
*/
export const getStudentNotifications = async (req, res) => {
  try {
    const studentId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        id,
        title,
        message,
        type,
        is_read,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [studentId]
    );

    const unreadResult = await pool.query(
      `
      SELECT COUNT(*) AS unread_count
      FROM notifications
      WHERE user_id = $1
        AND is_read = FALSE
      `,
      [studentId]
    );

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      notifications: result.rows,
      unread_count: Number(unreadResult.rows[0].unread_count),
    });
  } catch (error) {
    console.error("Get Student Notifications Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};


/*
  MARK ONE NOTIFICATION AS READ

  PATCH /api/student/notifications/:notificationId/read
*/
export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const studentId = req.user.id;

    const result = await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1
        AND user_id = $2
      RETURNING
        id,
        title,
        message,
        type,
        is_read,
        created_at
      `,
      [notificationId, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification: result.rows[0],
    });
  } catch (error) {
    console.error("Mark Notification As Read Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};


/*
  MARK ALL NOTIFICATIONS AS READ

  PATCH /api/student/notifications/read-all
*/
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const studentId = req.user.id;

    const result = await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE user_id = $1
        AND is_read = FALSE
      RETURNING id
      `,
      [studentId]
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      updated_count: result.rowCount,
    });
  } catch (error) {
    console.error("Mark All Notifications As Read Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
};