import pool from "../config/db.js";

/*
|--------------------------------------------------------------------------
| CampusCode Notification Controller
|--------------------------------------------------------------------------
|
| ADMIN:
|   - Send to one user
|   - Send to selected users
|   - Send to all students
|   - Send to all organizers
|   - Send to everyone
|   - Send to hackathon participants
|
| ORGANIZER:
|   - Send to one user
|   - Send to selected users
|   - Send to participants of their own hackathon
|
| STUDENT:
|   - Read notifications
|   - Mark read
|   - Mark all read
|   - Delete own notifications
|
|--------------------------------------------------------------------------
*/

const NOTIFICATION_TYPES = [
  "INFO",
  "SUCCESS",
  "WARNING",
  "ERROR",
  "ANNOUNCEMENT",
  "HACKATHON",
  "ROUND",
  "RESULT",
];

const AUDIENCES = [
  "USER",
  "SELECTED_USERS",
  "STUDENTS",
  "ORGANIZERS",
  "ALL_USERS",
  "HACKATHON_PARTICIPANTS",
];

/* =========================================================
   HELPERS
========================================================= */

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeType(value) {
  const type = cleanString(value).toUpperCase();

  return NOTIFICATION_TYPES.includes(type)
    ? type
    : "INFO";
}

function normalizeAudience(value) {
  const audience = cleanString(value).toUpperCase();

  return AUDIENCES.includes(audience)
    ? audience
    : null;
}

function isAdmin(req) {
  return req.user?.role === "ADMIN";
}

function isOrganizer(req) {
  return req.user?.role === "ORGANIZER";
}

function isAdminOrOrganizer(req) {
  return isAdmin(req) || isOrganizer(req);
}

/* =========================================================================
   CREATE / SEND NOTIFICATION
=========================================================================== */

export async function createNotification(req, res) {
  const client = await pool.connect();

  try {
    if (!isAdminOrOrganizer(req)) {
      return res.status(403).json({
        success: false,
        message:
          "Only admins and organizers can send notifications",
      });
    }

    const {
      user_id,
      user_ids,
      title,
      message,
      type,
      audience,
      hackathon_id,
    } = req.body;

    const cleanTitle = cleanString(title);
    const cleanMessage = cleanString(message);
    const normalizedType = normalizeType(type);

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message: "Notification title is required",
      });
    }

    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        message: "Notification message is required",
      });
    }

    if (cleanTitle.length > 200) {
      return res.status(400).json({
        success: false,
        message:
          "Notification title cannot exceed 200 characters",
      });
    }

    if (cleanMessage.length > 5000) {
      return res.status(400).json({
        success: false,
        message:
          "Notification message cannot exceed 5000 characters",
      });
    }

    let normalizedAudience = normalizeAudience(audience);

    /*
     * Backward compatibility.
     * If old frontend sends only user_id,
     * treat it as USER audience.
     */

    if (!normalizedAudience && user_id) {
      normalizedAudience = "USER";
    }

    if (!normalizedAudience) {
      return res.status(400).json({
        success: false,
        message:
          "Valid audience is required: USER, SELECTED_USERS, STUDENTS, ORGANIZERS, ALL_USERS or HACKATHON_PARTICIPANTS",
      });
    }

    /* =====================================================
       AUDIENCE VALIDATION
    ===================================================== */

    if (
      normalizedAudience === "USER" &&
      !user_id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "user_id is required for USER audience",
      });
    }

    if (
      normalizedAudience === "SELECTED_USERS" &&
      (!Array.isArray(user_ids) ||
        user_ids.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "user_ids array is required for SELECTED_USERS audience",
      });
    }

    if (
      normalizedAudience === "HACKATHON_PARTICIPANTS" &&
      !hackathon_id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "hackathon_id is required for HACKATHON_PARTICIPANTS audience",
      });
    }

    /* =====================================================
       ORGANIZER SECURITY
    ===================================================== */

    if (isOrganizer(req)) {
      /*
       * Organizers cannot send global notifications.
       */

      if (
        normalizedAudience === "STUDENTS" ||
        normalizedAudience === "ORGANIZERS" ||
        normalizedAudience === "ALL_USERS"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Organizers can only notify users related to their hackathons",
        });
      }

      /*
       * For participant notifications, verify ownership.
       */

      if (
        normalizedAudience === "HACKATHON_PARTICIPANTS" ||
        hackathon_id
      ) {
        if (!hackathon_id) {
          return res.status(400).json({
            success: false,
            message:
              "hackathon_id is required for organizer notifications",
          });
        }

        const hackathonResult = await client.query(
          `
          SELECT
            id,
            title,
            organizer_id
          FROM hackathons
          WHERE id = $1
          `,
          [hackathon_id]
        );

        if (hackathonResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Hackathon not found",
          });
        }

        if (
          hackathonResult.rows[0].organizer_id !==
          req.user.id
        ) {
          return res.status(403).json({
            success: false,
            message:
              "You can only send notifications for your own hackathons",
          });
        }
      }

      /*
       * USER / SELECTED_USERS
       *
       * Organizer may only notify users who
       * participate in one of their hackathons.
       *
       * IMPORTANT:
       * Current CampusCode schema uses
       * hackathon_participants.
       */

      if (
        normalizedAudience === "USER" ||
        normalizedAudience === "SELECTED_USERS"
      ) {
        const targetIds =
          normalizedAudience === "USER"
            ? [user_id]
            : [...new Set(user_ids)];

        if (targetIds.length === 0) {
          return res.status(400).json({
            success: false,
            message:
              "At least one target user is required",
          });
        }

        const placeholders = targetIds
          .map((_, index) => `$${index + 2}`)
          .join(", ");

        const participantCheck = await client.query(
          `
          SELECT DISTINCT
            hp.user_id
          FROM hackathon_participants hp
          INNER JOIN hackathons h
            ON h.id = hp.hackathon_id
          WHERE h.organizer_id = $1
            AND hp.user_id IN (${placeholders})
          `,
          [
            req.user.id,
            ...targetIds,
          ]
        );

        const allowedIds = new Set(
          participantCheck.rows.map(
            (row) => row.user_id
          )
        );

        const unauthorized = targetIds.filter(
          (id) => !allowedIds.has(id)
        );

        if (unauthorized.length > 0) {
          return res.status(403).json({
            success: false,
            message:
              "You can only notify participants of your own hackathons",
            unauthorized_user_ids:
              unauthorized,
          });
        }
      }
    }

    /* =====================================================
       RESOLVE RECIPIENTS
    ===================================================== */

    let recipientResult;

    switch (normalizedAudience) {
      /* ===================================================
         ONE USER
      =================================================== */

      case "USER":
        recipientResult = await client.query(
          `
          SELECT
            id
          FROM users
          WHERE id = $1
            AND is_active = true
          `,
          [user_id]
        );
        break;

      /* ===================================================
         SELECTED USERS
      =================================================== */

      case "SELECTED_USERS":
        recipientResult = await client.query(
          `
          SELECT
            id
          FROM users
          WHERE id = ANY($1::uuid[])
            AND is_active = true
          `,
          [[...new Set(user_ids)]]
        );
        break;

      /* ===================================================
         ALL STUDENTS
      =================================================== */

      case "STUDENTS":
        recipientResult = await client.query(
          `
          SELECT
            id
          FROM users
          WHERE role = 'STUDENT'
            AND is_active = true
          ORDER BY created_at ASC
          `
        );
        break;

      /* ===================================================
         ALL ORGANIZERS
      =================================================== */

      case "ORGANIZERS":
        recipientResult = await client.query(
          `
          SELECT
            id
          FROM users
          WHERE role = 'ORGANIZER'
            AND is_active = true
          ORDER BY created_at ASC
          `
        );
        break;

      /* ===================================================
         EVERYONE
      =================================================== */

      case "ALL_USERS":
        recipientResult = await client.query(
          `
          SELECT
            id
          FROM users
          WHERE is_active = true
          ORDER BY created_at ASC
          `
        );
        break;

      /* ===================================================
         HACKATHON PARTICIPANTS
      =================================================== */

      case "HACKATHON_PARTICIPANTS":
        /*
         * IMPORTANT:
         * Current CampusCode schema uses
         * hackathon_participants.
         */

        recipientResult = await client.query(
          `
          SELECT DISTINCT
            hp.user_id AS id
          FROM hackathon_participants hp
          INNER JOIN users u
            ON u.id = hp.user_id
          WHERE hp.hackathon_id = $1
            AND u.is_active = true
          ORDER BY hp.user_id
          `,
          [hackathon_id]
        );
        break;

      default:
        return res.status(400).json({
          success: false,
          message:
            "Invalid notification audience",
        });
    }

    /* =====================================================
       CHECK RECIPIENTS
    ===================================================== */

    const recipients = recipientResult.rows.map(
      (row) => row.id
    );

    if (recipients.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No active users found for this notification",
      });
    }

    /* =====================================================
       START TRANSACTION
    ===================================================== */

    await client.query("BEGIN");

    const values = [];
    const placeholders = [];

    recipients.forEach(
      (recipientId, index) => {
        const base = index * 4;

        values.push(
          recipientId,
          cleanTitle,
          cleanMessage,
          normalizedType
        );

        placeholders.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
        );
      }
    );

    /* =====================================================
       INSERT NOTIFICATIONS
    ===================================================== */

    const insertResult = await client.query(
      `
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type
      )
      VALUES
        ${placeholders.join(", ")}
      RETURNING
        id,
        user_id,
        title,
        message,
        type,
        is_read,
        created_at
      `,
      values
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message:
        "Notification sent successfully",
      audience: normalizedAudience,
      recipients_count:
        insertResult.rows.length,
      hackathon_id:
        hackathon_id || null,
      notifications:
        insertResult.rows,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    console.error(
      "CREATE NOTIFICATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to send notification",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  } finally {
    client.release();
  }
}

/* =========================================================================
   GET MY NOTIFICATIONS
=========================================================================== */

export async function getNotifications(
  req,
  res
) {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        user_id,
        title,
        message,
        type,
        is_read,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    const unreadResult = await pool.query(
      `
      SELECT
        COUNT(*)::integer AS unread_count
      FROM notifications
      WHERE user_id = $1
        AND is_read = false
      `,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      unread_count:
        unreadResult.rows[0].unread_count,
      notifications: result.rows,
    });
  } catch (error) {
    console.error(
      "GET NOTIFICATIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch notifications",
    });
  }
}

/* =========================================================================
   GET UNREAD COUNT
=========================================================================== */

export async function getUnreadNotificationCount(
  req,
  res
) {
  try {
    const result = await pool.query(
      `
      SELECT
        COUNT(*)::integer AS unread_count
      FROM notifications
      WHERE user_id = $1
        AND is_read = false
      `,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      unread_count:
        result.rows[0].unread_count,
    });
  } catch (error) {
    console.error(
      "GET UNREAD COUNT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch unread notification count",
    });
  }
}

/* =========================================================================
   MARK ONE AS READ
=========================================================================== */

export async function markNotificationAsRead(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message:
          "Notification id is required",
      });
    }

    const result = await pool.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE id = $1
        AND user_id = $2
      RETURNING
        id,
        user_id,
        title,
        message,
        type,
        is_read,
        created_at
      `,
      [
        id,
        req.user.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Notification marked as read",
      notification:
        result.rows[0],
    });
  } catch (error) {
    console.error(
      "MARK NOTIFICATION READ ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to mark notification as read",
    });
  }
}

/* =========================================================================
   MARK ALL AS READ
=========================================================================== */

export async function markAllNotificationsAsRead(
  req,
  res
) {
  try {
    const result = await pool.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE user_id = $1
        AND is_read = false
      RETURNING id
      `,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      message:
        "All notifications marked as read",
      updated_count:
        result.rows.length,
    });
  } catch (error) {
    console.error(
      "MARK ALL NOTIFICATIONS READ ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to mark all notifications as read",
    });
  }
}

/* =========================================================================
   DELETE ONE NOTIFICATION
=========================================================================== */

export async function deleteNotification(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message:
          "Notification id is required",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM notifications
      WHERE id = $1
        AND user_id = $2
      RETURNING id
      `,
      [
        id,
        req.user.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Notification deleted successfully",
      notification_id:
        result.rows[0].id,
    });
  } catch (error) {
    console.error(
      "DELETE NOTIFICATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete notification",
    });
  }
}

/* =========================================================================
   DELETE ALL MY READ NOTIFICATIONS
=========================================================================== */

export async function deleteReadNotifications(
  req,
  res
) {
  try {
    const result = await pool.query(
      `
      DELETE FROM notifications
      WHERE user_id = $1
        AND is_read = true
      RETURNING id
      `,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      message:
        "Read notifications deleted successfully",
      deleted_count:
        result.rows.length,
    });
  } catch (error) {
    console.error(
      "DELETE READ NOTIFICATIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete read notifications",
    });
  }
}

/* =========================================================================
   GET SENT / NOTIFICATION HISTORY
=========================================================================== */

export async function getNotificationHistory(
  req,
  res
) {
  try {
    if (!isAdminOrOrganizer(req)) {
      return res.status(403).json({
        success: false,
        message:
          "Only admins and organizers can view notification history",
      });
    }

    let query = `
      SELECT
        n.title,
        n.message,
        n.type,
        n.created_at,

        COUNT(*)::integer AS recipients_count,

        COUNT(*) FILTER (
          WHERE n.is_read = true
        )::integer AS read_count,

        COUNT(*) FILTER (
          WHERE n.is_read = false
        )::integer AS unread_count

      FROM notifications n
    `;

    const params = [];

    /* =====================================================
       ORGANIZER HISTORY
    ===================================================== */

    if (isOrganizer(req)) {
      /*
       * Current schema:
       * hackathon_participants
       */

      query += `
        INNER JOIN hackathon_participants hp
          ON hp.user_id = n.user_id

        INNER JOIN hackathons h
          ON h.id = hp.hackathon_id
          AND h.organizer_id = $1
      `;

      params.push(req.user.id);
    }

    query += `
      GROUP BY
        n.title,
        n.message,
        n.type,
        n.created_at

      ORDER BY
        n.created_at DESC

      LIMIT 100
    `;

    const result = await pool.query(
      query,
      params
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      notifications: result.rows,
    });
  } catch (error) {
    console.error(
      "GET NOTIFICATION HISTORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch notification history",
    });
  }
}

/* =========================================================================
   GET HACKATHON NOTIFICATION AUDIENCE
=========================================================================== */

export async function getHackathonNotificationAudience(
  req,
  res
) {
  try {
    if (!isAdminOrOrganizer(req)) {
      return res.status(403).json({
        success: false,
        message:
          "Only admins and organizers can view notification audience",
      });
    }

    const { hackathonId } = req.params;

    /* =====================================================
       GET HACKATHON
    ===================================================== */

    const hackathonResult = await pool.query(
      `
      SELECT
        id,
        title,
        organizer_id
      FROM hackathons
      WHERE id = $1
      `,
      [hackathonId]
    );

    if (hackathonResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Hackathon not found",
      });
    }

    const hackathon =
      hackathonResult.rows[0];

    /* =====================================================
       ORGANIZER OWNERSHIP
    ===================================================== */

    if (
      isOrganizer(req) &&
      hackathon.organizer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only view notification audience for your own hackathons",
      });
    }

    /* =====================================================
       GET PARTICIPANTS
    ===================================================== */

    /*
     * IMPORTANT:
     *
     * Current CampusCode schema uses
     * hackathon_participants.
     *
     * Do NOT use hackathon_registrations.
     */

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role
      FROM hackathon_participants hp
      INNER JOIN users u
        ON u.id = hp.user_id
      WHERE hp.hackathon_id = $1
        AND u.is_active = true
      ORDER BY u.name ASC
      `,
      [hackathonId]
    );

    return res.status(200).json({
      success: true,

      hackathon: {
        id: hackathon.id,
        title: hackathon.title,
      },

      count: result.rows.length,

      participants: result.rows,
    });
  } catch (error) {
    console.error(
      "GET HACKATHON NOTIFICATION AUDIENCE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch notification audience",

      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}
