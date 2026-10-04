import pool from "../config/db.js";

/* =========================================================
   GET FINAL LEADERBOARD

   Source of truth:
   round3_submissions

   R3 is completely manual:
   - Organizer reviews repository/demo
   - Organizer gives score
   - Organizer gives feedback
   - Organizer selects/rejects team

   Leaderboard shows only teams that were SELECTED.
========================================================= */

export async function getFinalLeaderboard(req, res) {
  try {
    const { hackathonId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    /* -------------------------------------------------------
       VALIDATE HACKATHON ID
    ------------------------------------------------------- */

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message: "Hackathon ID is required",
      });
    }

    /* -------------------------------------------------------
       GET HACKATHON
    ------------------------------------------------------- */

    const hackathonResult = await pool.query(
      `
        SELECT
          h.id,
          h.title,
          h.status,
          h.current_round,
          h.organizer_id,
          u.name AS organizer_name,
          u.email AS organizer_email
        FROM hackathons h
        LEFT JOIN users u
          ON u.id = h.organizer_id
        WHERE h.id = $1
      `,
      [hackathonId]
    );

    if (hackathonResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = hackathonResult.rows[0];

    /* -------------------------------------------------------
       ACCESS CONTROL

       ADMIN:
       Can view any leaderboard.

       ORGANIZER:
       Can view own hackathon leaderboard.

       STUDENT:
       Must be registered for this hackathon.
    ------------------------------------------------------- */

    if (userRole === "ADMIN") {
      // Allowed
    } else if (
      userRole === "ORGANIZER" &&
      String(hackathon.organizer_id) === String(userId)
    ) {
      // Allowed
    } else if (userRole === "STUDENT") {
      const participantResult = await pool.query(
        `
          SELECT id
          FROM hackathon_participants
          WHERE hackathon_id = $1
            AND user_id = $2
        `,
        [hackathonId, userId]
      );

      if (participantResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message:
            "You must be registered for this hackathon to view the leaderboard",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this leaderboard",
      });
    }

    /* -------------------------------------------------------
       GET R3 LEADERBOARD

       R3 is the final manual evaluation round.

       Only SELECTED teams are included.

       Score comes directly from:
       round3_submissions.score

       Decision comes directly from:
       round3_submissions.decision
    ------------------------------------------------------- */

    const leaderboardResult = await pool.query(
      `
        SELECT
          r3.id AS submission_id,
          r3.hackathon_id,
          r3.team_id,

          r3.github_url,
          r3.demo_url,
          r3.project_description,

          r3.status AS submission_status,
          r3.decision,
          r3.score,
          r3.organizer_feedback,

          r3.submitted_at,
          r3.reviewed_at,

          t.name AS team_name,
          t.leader_id,
          t.status AS team_status,

          leader.name AS leader_name,
          leader.email AS leader_email

        FROM round3_submissions r3

        INNER JOIN teams t
          ON t.id = r3.team_id
         AND t.hackathon_id = r3.hackathon_id

        LEFT JOIN users leader
          ON leader.id = t.leader_id

        WHERE r3.hackathon_id = $1
          AND r3.decision = 'SELECTED'
          AND r3.score IS NOT NULL

        ORDER BY
          r3.score DESC,
          r3.reviewed_at ASC NULLS LAST,
          r3.submitted_at ASC NULLS LAST
      `,
      [hackathonId]
    );

    /* -------------------------------------------------------
       GET TEAM MEMBERS

       We fetch members separately so the leaderboard response
       contains complete team information.
    ------------------------------------------------------- */

    const teamIds = leaderboardResult.rows.map(
      (row) => row.team_id
    );

    let membersByTeam = {};

    if (teamIds.length > 0) {
      const membersResult = await pool.query(
        `
          SELECT
            tm.team_id,
            tm.user_id,
            tm.role,
            tm.joined_at,

            u.name,
            u.email,
            u.avatar_url

          FROM team_members tm

          INNER JOIN users u
            ON u.id = tm.user_id

          WHERE tm.team_id = ANY($1::uuid[])

          ORDER BY
            tm.team_id,
            CASE
              WHEN tm.role = 'LEADER' THEN 0
              ELSE 1
            END,
            tm.joined_at ASC
        `,
        [teamIds]
      );

      for (const member of membersResult.rows) {
        if (!membersByTeam[member.team_id]) {
          membersByTeam[member.team_id] = [];
        }

        membersByTeam[member.team_id].push(member);
      }
    }

    /* -------------------------------------------------------
       BUILD LEADERBOARD
    ------------------------------------------------------- */

    const leaderboard = leaderboardResult.rows.map(
      (row, index) => {
        const rank = index + 1;

        let placement = "FINALIST";

        /*
         * If the team already has a final status such as
         * WINNER / FINALIST, preserve the database status.
         *
         * Otherwise the selected R3 team is simply a finalist.
         */

        if (row.team_status === "WINNER") {
          placement = "WINNER";
        } else if (row.team_status === "FINALIST") {
          placement = "FINALIST";
        }

        return {
          rank,

          submission_id: row.submission_id,

          team: {
            id: row.team_id,
            name: row.team_name,
            status: row.team_status,

            leader: {
              id: row.leader_id,
              name: row.leader_name,
              email: row.leader_email,
            },

            members: membersByTeam[row.team_id] || [],
          },

          score: Number(row.score),

          decision: row.decision,

          placement,

          submission: {
            github_url: row.github_url,
            demo_url: row.demo_url,
            project_description:
              row.project_description,
            status: row.submission_status,
            submitted_at: row.submitted_at,
            reviewed_at: row.reviewed_at,
          },

          organizer_feedback:
            row.organizer_feedback,
        };
      }
    );

    /* -------------------------------------------------------
       RESPONSE
    ------------------------------------------------------- */

    return res.status(200).json({
      success: true,

      message: "Final leaderboard fetched successfully",

      hackathon: {
        id: hackathon.id,
        title: hackathon.title,
        status: hackathon.status,
        current_round: hackathon.current_round,

        organizer: {
          id: hackathon.organizer_id,
          name: hackathon.organizer_name,
          email: hackathon.organizer_email,
        },
      },

      total_teams: leaderboard.length,

      leaderboard,
    });
  } catch (error) {
    console.error(
      "FINAL LEADERBOARD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch final leaderboard",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}