import pool from "../config/db.js";

/* =========================================================
   ORGANIZER DASHBOARD
========================================================= */

export async function getOrganizerDashboard(req, res) {
  try {
    const organizerId = req.user.id;

    /* =====================================================
       DASHBOARD STATS
    ===================================================== */

    const statsResult = await pool.query(
      `
      SELECT
        COUNT(DISTINCT h.id)::integer AS total_hackathons,

        COUNT(
          DISTINCT CASE
            WHEN h.status IN ('OPEN', 'LIVE', 'PAUSED')
            THEN h.id
          END
        )::integer AS active_hackathons,

        COUNT(DISTINCT hp.user_id)::integer AS participants,

        COUNT(DISTINCT t.id)::integer AS teams,

        COUNT(DISTINCT s.id)::integer AS submissions,

        COUNT(
          DISTINCT CASE
            WHEN s.status = 'REVIEWED'
            THEN s.id
          END
        )::integer AS reviewed_submissions

      FROM hackathons h

      LEFT JOIN hackathon_participants hp
        ON hp.hackathon_id = h.id

      LEFT JOIN teams t
        ON t.hackathon_id = h.id

      LEFT JOIN projects p
        ON p.team_id = t.id

      LEFT JOIN submissions s
        ON s.project_id = p.id

      WHERE h.organizer_id = $1
      `,
      [organizerId]
    );

    /* =====================================================
       ORGANIZER HACKATHONS
    ===================================================== */

    const hackathonsResult = await pool.query(
      `
      SELECT
        h.id,
        h.title,
        h.description,
        h.organizer_id,

        h.track,
        h.location,

        h.start_date,
        h.end_date,
        h.registration_deadline,

        h.max_teams,

        h.status,

        h.approval_status,
        h.approval_feedback,
        h.approved_by,
        h.approved_at,

        h.publication_status,
        h.published_at,
        h.published_by,

        h.current_round,

        h.created_at,
        h.updated_at,

        COUNT(DISTINCT hp.user_id)::integer
          AS participant_count,

        COUNT(DISTINCT t.id)::integer
          AS team_count,

        COUNT(DISTINCT s.id)::integer
          AS submission_count,

        COUNT(
          DISTINCT CASE
            WHEN s.status = 'REVIEWED'
            THEN s.id
          END
        )::integer AS reviewed_submission_count

      FROM hackathons h

      LEFT JOIN hackathon_participants hp
        ON hp.hackathon_id = h.id

      LEFT JOIN teams t
        ON t.hackathon_id = h.id

      LEFT JOIN projects p
        ON p.team_id = t.id

      LEFT JOIN submissions s
        ON s.project_id = p.id

      WHERE h.organizer_id = $1

      GROUP BY
        h.id,
        h.title,
        h.description,
        h.organizer_id,

        h.track,
        h.location,

        h.start_date,
        h.end_date,
        h.registration_deadline,

        h.max_teams,

        h.status,

        h.approval_status,
        h.approval_feedback,
        h.approved_by,
        h.approved_at,

        h.publication_status,
        h.published_at,
        h.published_by,

        h.current_round,

        h.created_at,
        h.updated_at

      ORDER BY
        CASE h.status
          WHEN 'LIVE' THEN 1
          WHEN 'OPEN' THEN 2
          WHEN 'PAUSED' THEN 3
          WHEN 'DRAFT' THEN 4
          WHEN 'COMPLETED' THEN 5
          ELSE 6
        END,

        h.created_at DESC
      `,
      [organizerId]
    );

    /* =====================================================
       CURRENT HACKATHON
    ===================================================== */

    const currentHackathon =
      hackathonsResult.rows.find(
        (hackathon) => hackathon.status === "LIVE"
      ) ||
      hackathonsResult.rows.find(
        (hackathon) => hackathon.status === "PAUSED"
      ) ||
      hackathonsResult.rows.find(
        (hackathon) => hackathon.status === "OPEN"
      ) ||
      hackathonsResult.rows[0] ||
      null;

    /* =====================================================
       STATS
    ===================================================== */

    const stats = statsResult.rows[0] || {};

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,

      stats: {
        total_hackathons: Number(
          stats.total_hackathons || 0
        ),

        active_hackathons: Number(
          stats.active_hackathons || 0
        ),

        participants: Number(
          stats.participants || 0
        ),

        teams: Number(
          stats.teams || 0
        ),

        submissions: Number(
          stats.submissions || 0
        ),

        reviewed_submissions: Number(
          stats.reviewed_submissions || 0
        ),
      },

      current_hackathon: currentHackathon,

      hackathons: hackathonsResult.rows,
    });

  } catch (error) {
    console.error(
      "GET ORGANIZER DASHBOARD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load organizer dashboard",

      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}