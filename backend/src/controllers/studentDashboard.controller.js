import pool from "../config/db.js";

/* =========================================================
   STUDENT DASHBOARD CONTROLLER
   CampusCode

   Single canonical student dashboard controller.

   GET /api/student/dashboard

   Returns:
   - Student information
   - Registered hackathon count
   - Ongoing hackathon count
   - Completed hackathon count
   - Team count
   - Project count
   - Winner count
   - Current hackathon
   - Current team
   - Current project
   - Current submission
   - Score / rank
   - Notifications

   IMPORTANT:
   This controller intentionally keeps both:
   - current_event.hackathon / current_event.team
   - flat compatibility fields

   so the existing StudentPanel can consume the response
   without requiring another backend format change.
========================================================= */


/* =========================================================
   GET STUDENT DASHBOARD
========================================================= */

export async function getStudentDashboard(req, res) {
  try {
    const userId = req.user.id;

    /* =======================================================
       1. GET STUDENT
    ======================================================= */

    const studentResult = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        role,
        avatar_url,
        bio,
        skills,
        campus_code_id
      FROM users
      WHERE id = $1
        AND role = 'STUDENT'
        AND is_active = TRUE
      `,
      [userId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student = studentResult.rows[0];


    /* =======================================================
       2. HACKATHON STATISTICS

       Use DISTINCT because one student can have multiple
       related team/project records.

       Registration status is intentionally NOT restricted
       to only ACTIVE because the registration controller
       creates registrations with status REGISTERED.
    ======================================================= */

    const hackathonStatsResult = await pool.query(
      `
      SELECT
        COUNT(DISTINCT hp.hackathon_id)::integer
          AS registered_hackathons,

        COUNT(DISTINCT hp.hackathon_id)
          FILTER (
            WHERE h.status IN ('OPEN', 'LIVE', 'PAUSED')
          )::integer
          AS ongoing_hackathons,

        COUNT(DISTINCT hp.hackathon_id)
          FILTER (
            WHERE h.status IN (
              'COMPLETED',
              'COMPLETE',
              'FINISHED',
              'CLOSED',
              'ARCHIVED'
            )
            OR h.current_round = 4
          )::integer
          AS completed_hackathons

      FROM hackathon_participants hp

      INNER JOIN hackathons h
        ON h.id = hp.hackathon_id

      WHERE hp.user_id = $1
      `,
      [userId]
    );


    /* =======================================================
       3. TEAM STATISTICS
    ======================================================= */

    const teamStatsResult = await pool.query(
      `
      SELECT
        COUNT(DISTINCT tm.team_id)::integer
          AS total_teams

      FROM team_members tm

      INNER JOIN teams t
        ON t.id = tm.team_id

      WHERE tm.user_id = $1
      `,
      [userId]
    );


    /* =======================================================
       4. PROJECT STATISTICS
    ======================================================= */

    const projectStatsResult = await pool.query(
      `
      SELECT
        COUNT(DISTINCT p.id)::integer
          AS total_projects

      FROM projects p

      INNER JOIN teams t
        ON t.id = p.team_id

      INNER JOIN team_members tm
        ON tm.team_id = t.id

      WHERE tm.user_id = $1
      `,
      [userId]
    );


    /* =======================================================
       5. WINNER STATISTICS
    ======================================================= */

    const winsResult = await pool.query(
      `
      SELECT
        COUNT(DISTINCT t.id)::integer
          AS total_wins

      FROM teams t

      INNER JOIN team_members tm
        ON tm.team_id = t.id

      WHERE tm.user_id = $1
        AND t.status = 'WINNER'
      `,
      [userId]
    );


    /* =======================================================
       6. RECENT REGISTERED HACKATHONS

       IMPORTANT:
       One row per hackathon.

       The team is selected through a LATERAL query so
       multiple teams/projects cannot duplicate the same
       hackathon.
    ======================================================= */

    const recentHackathonsResult = await pool.query(
      `
      SELECT
        h.id,
        h.title,
        h.description,
        h.track,
        h.location,
        h.start_date,
        h.end_date,
        h.registration_deadline,
        h.status,
        h.current_round,
        h.approval_status,
        h.publication_status,

        team_data.team_id,
        team_data.team_name,
        team_data.team_status

      FROM hackathon_participants hp

      INNER JOIN hackathons h
        ON h.id = hp.hackathon_id

      LEFT JOIN LATERAL (
        SELECT
          t.id AS team_id,
          t.name AS team_name,
          t.status AS team_status

        FROM team_members tm

        INNER JOIN teams t
          ON t.id = tm.team_id

        WHERE tm.user_id = $1
          AND t.hackathon_id = h.id

        ORDER BY t.id

        LIMIT 1
      ) team_data ON TRUE

      WHERE hp.user_id = $1

      ORDER BY h.created_at DESC NULLS LAST

      LIMIT 5
      `,
      [userId]
    );


    /* =======================================================
       7. NOTIFICATIONS
    ======================================================= */

    const notificationsResult = await pool.query(
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

      LIMIT 5
      `,
      [userId]
    );


    /* =======================================================
       8. UNREAD NOTIFICATION COUNT
    ======================================================= */

    const unreadResult = await pool.query(
      `
      SELECT
        COUNT(*)::integer AS unread_count

      FROM notifications

      WHERE user_id = $1
        AND is_read = FALSE
      `,
      [userId]
    );


    /* =======================================================
       9. FIND CURRENT HACKATHON

       Priority:
       LIVE
       PAUSED
       OPEN
       then other registered hackathons.

       A student does NOT need a team for the hackathon
       to appear as the current registered event.
    ======================================================= */

    const currentHackathonResult = await pool.query(
      `
      SELECT
        h.id AS hackathon_id,
        h.title AS hackathon_title,
        h.description AS hackathon_description,
        h.track AS hackathon_track,
        h.location AS hackathon_location,
        h.status AS hackathon_status,
        h.publication_status,
        h.current_round,
        h.start_date,
        h.end_date,
        h.registration_deadline,

        team_data.team_id,
        team_data.team_name,
        team_data.team_status,

        project_data.project_id,
        project_data.project_title,
        project_data.project_track,
        project_data.completion_percentage,

        submission_data.submission_id,
        submission_data.submission_status,
        submission_data.submitted_at

      FROM hackathon_participants hp

      INNER JOIN hackathons h
        ON h.id = hp.hackathon_id

      LEFT JOIN LATERAL (
        SELECT
          t.id AS team_id,
          t.name AS team_name,
          t.status AS team_status

        FROM team_members tm

        INNER JOIN teams t
          ON t.id = tm.team_id

        WHERE tm.user_id = $1
          AND t.hackathon_id = h.id

        ORDER BY t.id

        LIMIT 1
      ) team_data ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          p.id AS project_id,
          p.title AS project_title,
          p.track AS project_track,
          p.completion_percentage

        FROM projects p

        WHERE p.team_id = team_data.team_id

        ORDER BY p.id

        LIMIT 1
      ) project_data ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          s.id AS submission_id,
          s.status AS submission_status,
          s.submitted_at

        FROM submissions s

        WHERE s.project_id = project_data.project_id

        ORDER BY s.submitted_at DESC NULLS LAST, s.id DESC

        LIMIT 1
      ) submission_data ON TRUE

      WHERE hp.user_id = $1

      ORDER BY
        CASE h.status
          WHEN 'LIVE' THEN 1
          WHEN 'PAUSED' THEN 2
          WHEN 'OPEN' THEN 3
          ELSE 4
        END,

        CASE
          WHEN h.current_round = 4 THEN 2
          ELSE 1
        END,

        h.start_date DESC NULLS LAST

      LIMIT 1
      `,
      [userId]
    );


    /* =======================================================
       10. CURRENT TEAM MEMBER COUNT
    ======================================================= */

    let currentEvent = null;

    if (currentHackathonResult.rows.length > 0) {
      const current =
        currentHackathonResult.rows[0];

      let memberCount = 0;

      if (current.team_id) {
        const memberCountResult = await pool.query(
          `
          SELECT
            COUNT(*)::integer AS count

          FROM team_members

          WHERE team_id = $1
          `,
          [current.team_id]
        );

        memberCount =
          Number(
            memberCountResult.rows[0]?.count || 0
          );
      }


      /* =====================================================
         11. CURRENT TEAM SCORE / RANK

         Only completed evaluations are considered.
      ===================================================== */

      let score = null;
      let rank = null;

      if (current.team_id) {
        const rankingResult = await pool.query(
          `
          WITH team_scores AS (
            SELECT
              t.id AS team_id,
              ROUND(
                AVG(e.overall_score)::numeric,
                2
              ) AS score

            FROM teams t

            INNER JOIN projects p
              ON p.team_id = t.id

            INNER JOIN submissions s
              ON s.project_id = p.id

            INNER JOIN evaluations e
              ON e.submission_id = s.id

            WHERE e.status = 'COMPLETED'

            GROUP BY t.id
          ),

          ranked_teams AS (
            SELECT
              team_id,
              score,
              RANK() OVER (
                ORDER BY score DESC
              ) AS rank

            FROM team_scores
          )

          SELECT
            score,
            rank

          FROM ranked_teams

          WHERE team_id = $1
          `,
          [current.team_id]
        );

        if (rankingResult.rows.length > 0) {
          score =
            rankingResult.rows[0].score === null
              ? null
              : Number(
                  rankingResult.rows[0].score
                );

          rank =
            rankingResult.rows[0].rank === null
              ? null
              : Number(
                  rankingResult.rows[0].rank
                );
        }
      }


      /* =====================================================
         12. CURRENT EVENT OBJECT

         Keep nested structure for backend consumers.

         Also expose flat fields because the existing
         StudentPanel currently reads current.title,
         current.status, etc.
      ===================================================== */

      currentEvent = {
        /* ---------------------------------------------------
           Flat compatibility fields
        --------------------------------------------------- */

        id:
          current.hackathon_id,

        title:
          current.hackathon_title,

        name:
          current.hackathon_title,

        description:
          current.hackathon_description,

        track:
          current.hackathon_track,

        location:
          current.hackathon_location,

        status:
          current.hackathon_status,

        publication_status:
          current.publication_status,

        current_round:
          Number(
            current.current_round || 0
          ),

        start_date:
          current.start_date,

        end_date:
          current.end_date,

        registration_deadline:
          current.registration_deadline,

        /* ---------------------------------------------------
           Nested hackathon object
        --------------------------------------------------- */

        hackathon: {
          id:
            current.hackathon_id,

          title:
            current.hackathon_title,

          description:
            current.hackathon_description,

          track:
            current.hackathon_track,

          location:
            current.hackathon_location,

          status:
            current.hackathon_status,

          publication_status:
            current.publication_status,

          current_round:
            Number(
              current.current_round || 0
            ),

          start_date:
            current.start_date,

          end_date:
            current.end_date,

          registration_deadline:
            current.registration_deadline,
        },

        /* ---------------------------------------------------
           Team
        --------------------------------------------------- */

        team: current.team_id
          ? {
              id:
                current.team_id,

              name:
                current.team_name,

              status:
                current.team_status,

              member_count:
                memberCount,
            }
          : null,

        /* ---------------------------------------------------
           Project
        --------------------------------------------------- */

        project: current.project_id
          ? {
              id:
                current.project_id,

              title:
                current.project_title,

              track:
                current.project_track,

              completion_percentage:
                current.completion_percentage ?? 0,
            }
          : null,

        /* ---------------------------------------------------
           Submission
        --------------------------------------------------- */

        submission:
          current.submission_id
            ? {
                id:
                  current.submission_id,

                status:
                  current.submission_status,

                submitted_at:
                  current.submitted_at,
              }
            : null,

        score,

        rank,
      };
    }


    /* =======================================================
       13. PREPARE STATISTICS
    ======================================================= */

    const hackathonStats =
      hackathonStatsResult.rows[0] || {};

    const teamStats =
      teamStatsResult.rows[0] || {};

    const projectStats =
      projectStatsResult.rows[0] || {};

    const wins =
      winsResult.rows[0] || {};

    const unreadCount =
      unreadResult.rows[0] || {};


    const registered =
      Number(
        hackathonStats.registered_hackathons || 0
      );

    const ongoing =
      Number(
        hackathonStats.ongoing_hackathons || 0
      );

    const completed =
      Number(
        hackathonStats.completed_hackathons || 0
      );

    const totalTeams =
      Number(
        teamStats.total_teams || 0
      );

    const totalProjects =
      Number(
        projectStats.total_projects || 0
      );

    const totalWins =
      Number(
        wins.total_wins || 0
      );

    const unreadNotifications =
      Number(
        unreadCount.unread_count || 0
      );


    /* =======================================================
       14. FINAL RESPONSE
    ======================================================= */

    return res.status(200).json({
      success: true,

      message:
        "Student dashboard fetched successfully",

      /* -----------------------------------------------------
         Student
      ----------------------------------------------------- */

      user: {
        id:
          student.id,

        name:
          student.name,

        email:
          student.email,

        role:
          student.role,

        avatar_url:
          student.avatar_url,

        bio:
          student.bio,

        skills:
          student.skills,

        campus_code_id:
          student.campus_code_id || null,
      },

      /* -----------------------------------------------------
         Student compatibility object
      ----------------------------------------------------- */

      student: {
        id:
          student.id,

        name:
          student.name,

        email:
          student.email,

        role:
          student.role,

        avatar_url:
          student.avatar_url,

        bio:
          student.bio,

        skills:
          student.skills,

        campus_code_id:
          student.campus_code_id || null,
      },

      /* -----------------------------------------------------
         Statistics

         Both new and legacy names are returned.
      ----------------------------------------------------- */

      stats: {
        registered:
          registered,

        registered_count:
          registered,

        registered_hackathons:
          registered,

        ongoing:
          ongoing,

        ongoing_count:
          ongoing,

        active_hackathons:
          ongoing,

        completed:
          completed,

        completed_count:
          completed,

        completed_hackathons:
          completed,

        certificates:
          0,

        certificate_count:
          0,

        teams:
          totalTeams,

        total_teams:
          totalTeams,

        projects:
          totalProjects,

        total_projects:
          totalProjects,

        wins:
          totalWins,

        total_wins:
          totalWins,

        unread_notifications:
          unreadNotifications,

        current_rank:
          currentEvent?.rank || null,
      },

      /* -----------------------------------------------------
         Current event
      ----------------------------------------------------- */

      current_event:
        currentEvent,

      /* -----------------------------------------------------
         Compatibility alias
      ----------------------------------------------------- */

      current_hackathon:
        currentEvent
          ? {
              ...currentEvent,

              id:
                currentEvent.hackathon?.id,

              title:
                currentEvent.hackathon?.title,

              description:
                currentEvent.hackathon?.description,

              track:
                currentEvent.hackathon?.track,

              location:
                currentEvent.hackathon?.location,

              status:
                currentEvent.hackathon?.status,

              current_round:
                currentEvent.hackathon?.current_round,

              start_date:
                currentEvent.hackathon?.start_date,

              end_date:
                currentEvent.hackathon?.end_date,
            }
          : null,

      /* -----------------------------------------------------
         Recent registered hackathons
      ----------------------------------------------------- */

      recent_hackathons:
        recentHackathonsResult.rows.map(
          (row) => ({
            id:
              row.id,

            hackathon_id:
              row.id,

            title:
              row.title,

            name:
              row.title,

            description:
              row.description,

            track:
              row.track,

            location:
              row.location,

            start_date:
              row.start_date,

            end_date:
              row.end_date,

            registration_deadline:
              row.registration_deadline,

            status:
              row.status,

            current_round:
              Number(
                row.current_round || 0
              ),

            approval_status:
              row.approval_status,

            publication_status:
              row.publication_status,

            team:
              row.team_id
                ? {
                    id:
                      row.team_id,

                    name:
                      row.team_name,

                    status:
                      row.team_status,
                  }
                : null,
          })
        ),

      /* -----------------------------------------------------
         Notifications
      ----------------------------------------------------- */

      notifications:
        notificationsResult.rows,

      unread_notification_count:
        unreadNotifications,
    });
  } catch (error) {
    console.error(
      "GET STUDENT DASHBOARD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load student dashboard",
    });
  }
}