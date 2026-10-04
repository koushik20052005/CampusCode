import pool from "../config/db.js";

/**
 * GET /api/dashboard/admin
 * Admin dashboard statistics and overview
 */
export async function getAdminDashboard(req, res) {
  try {
    // Total users
    const usersResult = await pool.query(`
      SELECT COUNT(*)::int AS total_users
      FROM users
    `);

    // Active users
    const activeUsersResult = await pool.query(`
      SELECT COUNT(*)::int AS active_users
      FROM users
      WHERE COALESCE(is_active, true) = true
    `);

    // Total students
    const studentsResult = await pool.query(`
      SELECT COUNT(*)::int AS total_students
      FROM users
      WHERE role = 'STUDENT'
    `);

    // Total organizers
    const organizersResult = await pool.query(`
      SELECT COUNT(*)::int AS total_organizers
      FROM users
      WHERE role = 'ORGANIZER'
    `);

    // Total admins
    const adminsResult = await pool.query(`
      SELECT COUNT(*)::int AS total_admins
      FROM users
      WHERE role = 'ADMIN'
    `);

    // Total hackathons
    const hackathonsResult = await pool.query(`
      SELECT COUNT(*)::int AS total_hackathons
      FROM hackathons
    `);

    // Published hackathons
    const publishedHackathonsResult = await pool.query(`
      SELECT COUNT(*)::int AS published_hackathons
      FROM hackathons
      WHERE publication_status = 'PUBLISHED'
    `);

    // Pending hackathons
    // Pending hackathons
    const pendingHackathonsResult = await pool.query(`
    SELECT COUNT(*)::int AS pending_hackathons
    FROM hackathons
    WHERE approval_status = 'PENDING'
    `);

    // Total teams
    const teamsResult = await pool.query(`
      SELECT COUNT(*)::int AS total_teams
      FROM teams
    `);

    // Total submissions
    const submissionsResult = await pool.query(`
      SELECT COUNT(*)::int AS total_submissions
      FROM submissions
    `);

    // Recent users
    const recentUsersResult = await pool.query(`
      SELECT
        id,
        name,
        email,
        role,
        COALESCE(is_active, true) AS is_active,
        created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // Recent hackathons
    const recentHackathonsResult = await pool.query(`
      SELECT
        id,
        title,
        track,
        publication_status,
        status,
        start_date,
        end_date,
        created_at
      FROM hackathons
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.status(200).json({
      success: true,

      stats: {
        total_users: usersResult.rows[0].total_users,
        active_users: activeUsersResult.rows[0].active_users,
        total_students: studentsResult.rows[0].total_students,
        total_organizers: organizersResult.rows[0].total_organizers,
        total_admins: adminsResult.rows[0].total_admins,
        total_hackathons: hackathonsResult.rows[0].total_hackathons,
        published_hackathons:
          publishedHackathonsResult.rows[0].published_hackathons,
        pending_hackathons:
          pendingHackathonsResult.rows[0].pending_hackathons,
        total_teams: teamsResult.rows[0].total_teams,
        total_submissions: submissionsResult.rows[0].total_submissions,
      },

      recent_users: recentUsersResult.rows,
      recent_hackathons: recentHackathonsResult.rows,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load admin dashboard",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}