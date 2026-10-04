import pool from "../config/db.js";

/* =========================================================
   GET PENDING RESULT REQUESTS
   Admin can view organizer result publication requests
========================================================= */

export async function getPendingResultRequests(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        rr.id,
        rr.hackathon_id,
        rr.requested_by,
        rr.status,
        rr.requested_at,
        rr.reviewed_by,
        rr.reviewed_at,
        rr.admin_feedback,
        rr.created_at,
        rr.updated_at,

        h.title AS hackathon_title,
        h.organizer_id,
        h.status AS hackathon_status,
        h.current_round,

        u.name AS organizer_name,
        u.email AS organizer_email,

        (
          SELECT COUNT(*)::int
          FROM round3_submissions r3
          WHERE r3.hackathon_id = h.id
            AND r3.decision = 'SELECTED'
            AND r3.score IS NOT NULL
        ) AS total_selected

      FROM result_requests rr

      INNER JOIN hackathons h
        ON h.id = rr.hackathon_id

      INNER JOIN users u
        ON u.id = h.organizer_id

      WHERE rr.status = 'PENDING'

      ORDER BY rr.requested_at ASC
      `
    );

    return res.status(200).json({
      success: true,

      message:
        "Pending result requests fetched successfully",

      total_requests:
        result.rows.length,

      requests:
        result.rows,
    });
  } catch (error) {
    console.error(
      "GET PENDING RESULT REQUESTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch pending result requests",

      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}


/* =========================================================
   APPROVE RESULT REQUEST
   Admin approves and publishes final Round 3 results

   POST
   /api/admin/result-requests/:requestId/approve
========================================================= */

export async function approveResultRequest(
  req,
  res
) {
  const client =
    await pool.connect();

  try {
    const {
      requestId,
    } = req.params;

    if (!requestId) {
      return res.status(400).json({
        success: false,

        message:
          "Request ID is required",
      });
    }

    /* =====================================================
       1. START TRANSACTION
    ===================================================== */

    await client.query(
      "BEGIN"
    );


    /* =====================================================
       2. GET RESULT REQUEST
    ===================================================== */

    const requestResult =
      await client.query(
        `
        SELECT
          id,
          hackathon_id,
          requested_by,
          status,
          requested_at
        FROM result_requests
        WHERE id = $1
        FOR UPDATE
        `,
        [requestId]
      );

    if (
      requestResult.rows.length === 0
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(404).json({
        success: false,

        message:
          "Result request not found",
      });
    }

    const request =
      requestResult.rows[0];


    /* =====================================================
       3. REQUEST MUST BE PENDING
    ===================================================== */

    if (
      request.status !==
      "PENDING"
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(400).json({
        success: false,

        message:
          `Result request is already ${request.status}`,
      });
    }


    /* =====================================================
       4. GET HACKATHON
    ===================================================== */

    const hackathonResult =
      await client.query(
        `
        SELECT
          id,
          title,
          status,
          current_round,
          organizer_id
        FROM hackathons
        WHERE id = $1
        FOR UPDATE
        `,
        [
          request.hackathon_id,
        ]
      );

    if (
      hackathonResult.rows.length === 0
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(404).json({
        success: false,

        message:
          "Hackathon not found",
      });
    }

    const hackathon =
      hackathonResult.rows[0];


    /* =====================================================
       5. HACKATHON MUST BE IN ROUND 3
    ===================================================== */

    if (
      Number(
        hackathon.current_round
      ) !== 3
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(400).json({
        success: false,

        message:
          "Hackathon must be in Round 3 before results can be approved",

        current_round:
          Number(
            hackathon.current_round
          ),
      });
    }


    /* =====================================================
       6. GET ROUND 3 SUBMISSIONS
       
       IMPORTANT:
       We use round3_submissions directly.

       Correct columns:
       - github_url
       - demo_url
       - project_description
       - status
       - decision
       - score
       - organizer_feedback
       - reviewed_at
    ===================================================== */

    const submissionsResult =
      await client.query(
        `
        SELECT
          r3.id AS submission_id,

          r3.hackathon_id,
          r3.team_id,
          r3.submitted_by,

          r3.github_url,
          r3.demo_url,
          r3.project_description,

          r3.status AS submission_status,
          r3.decision,
          r3.score,
          r3.organizer_feedback,

          r3.reviewed_by,
          r3.reviewed_at,
          r3.submitted_at,

          t.name AS team_name,
          t.status AS team_status,

          (
            SELECT
              STRING_AGG(
                DISTINCT u.name,
                ', '
                ORDER BY u.name
              )
            FROM team_members tm

            INNER JOIN users u
              ON u.id = tm.user_id

            WHERE tm.team_id = t.id
          ) AS members

        FROM round3_submissions r3

        INNER JOIN teams t
          ON t.id = r3.team_id

        WHERE
          r3.hackathon_id = $1

        ORDER BY
          CASE
            WHEN r3.decision = 'SELECTED'
              THEN 0
            ELSE 1
          END,

          r3.score DESC NULLS LAST,

          r3.reviewed_at ASC NULLS LAST,

          t.name ASC
        `,
        [
          request.hackathon_id,
        ]
      );


    /* =====================================================
       7. REQUIRE AT LEAST ONE SELECTED ROUND 3 SUBMISSION
    ===================================================== */

    const selectedSubmissions =
      submissionsResult.rows.filter(
        (row) =>
          row.decision ===
          "SELECTED"
      );


    if (
      selectedSubmissions.length === 0
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(400).json({
        success: false,

        message:
          "No Round 3 submission has been selected for publication",
      });
    }


    /* =====================================================
       8. REQUIRE SELECTED SUBMISSIONS TO HAVE SCORES
    ===================================================== */

    const missingScores =
      selectedSubmissions.filter(
        (row) =>
          row.score === null ||
          row.score === undefined
      );


    if (
      missingScores.length > 0
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(400).json({
        success: false,

        message:
          "Every selected Round 3 submission must have a score before results can be published",

        missing_score_submissions:
          missingScores.map(
            (row) => ({
              submission_id:
                row.submission_id,

              team_id:
                row.team_id,

              team_name:
                row.team_name,
            })
          ),
      });
    }


    /* =====================================================
       9. REMOVE DUPLICATE TEAMS
    ===================================================== */

    const uniqueTeams =
      new Map();

    for (
      const row of selectedSubmissions
    ) {
      if (
        !uniqueTeams.has(
          row.team_id
        )
      ) {
        uniqueTeams.set(
          row.team_id,
          row
        );
      }
    }


    /* =====================================================
       10. SORT FINAL RESULTS BY SCORE
    ===================================================== */

    const leaderboard =
      Array.from(
        uniqueTeams.values()
      ).sort(
        (a, b) => {
          const scoreA =
            Number(
              a.score || 0
            );

          const scoreB =
            Number(
              b.score || 0
            );

          if (
            scoreB !== scoreA
          ) {
            return (
              scoreB -
              scoreA
            );
          }

          return String(
            a.team_name ||
              ""
          ).localeCompare(
            String(
              b.team_name ||
                ""
            )
          );
        }
      );


    /* =====================================================
       11. ASSIGN FINAL RANKS
    ===================================================== */

    leaderboard.forEach(
      (team, index) => {
        team.rank =
          index + 1;

        if (
          team.rank === 1
        ) {
          team.placement =
            "WINNER";
        } else if (
          team.rank === 2
        ) {
          team.placement =
            "RUNNER_UP";
        } else if (
          team.rank === 3
        ) {
          team.placement =
            "SECOND_RUNNER_UP";
        } else {
          team.placement =
            "FINALIST";
        }

        team.score =
          Number(
            team.score || 0
          );

        team.members =
          team.members
            ? team.members
                .split(", ")
            : [];

        /*
         * IMPORTANT:
         * Use organizer_feedback.
         *
         * NOT:
         * row.feedback
         */
        team.feedback =
          team.organizer_feedback ||
          null;
      }
    );


    /* =====================================================
       12. UPDATE TEAM STATUSES
    ===================================================== */

    for (
      const team of leaderboard
    ) {
      if (
        team.placement ===
        "WINNER"
      ) {
        await client.query(
          `
          UPDATE teams
          SET
            status = 'WINNER',
            updated_at = NOW()
          WHERE id = $1
          `,
          [
            team.team_id,
          ]
        );
      } else {
        await client.query(
          `
          UPDATE teams
          SET
            status = 'FINALIST',
            updated_at = NOW()
          WHERE id = $1
          `,
          [
            team.team_id,
          ]
        );
      }
    }


    /* =====================================================
       13. MARK HACKATHON COMPLETED
    ===================================================== */

    const completedHackathonResult =
      await client.query(
        `
        UPDATE hackathons

        SET
          status = 'COMPLETED',
          current_round = 4,
          updated_at = NOW()

        WHERE id = $1

        RETURNING
          id,
          title,
          status,
          current_round,
          organizer_id,
          updated_at
        `,
        [
          request.hackathon_id,
        ]
      );


    const completedHackathon =
      completedHackathonResult
        .rows[0];


    /* =====================================================
       14. APPROVE RESULT REQUEST
    ===================================================== */

    const updatedRequestResult =
      await client.query(
        `
        UPDATE result_requests

        SET
          status = 'APPROVED',
          reviewed_by = $1,
          reviewed_at = NOW(),
          admin_feedback = $2,
          updated_at = NOW()

        WHERE id = $3

        RETURNING
          id,
          hackathon_id,
          requested_by,
          status,
          requested_at,
          reviewed_by,
          reviewed_at,
          admin_feedback
        `,
        [
          req.user.id,

          "Result publication approved by Admin.",

          requestId,
        ]
      );


    const updatedRequest =
      updatedRequestResult
        .rows[0];


    /* =====================================================
       15. COMMIT
    ===================================================== */

    await client.query(
      "COMMIT"
    );


    /* =====================================================
       16. BUILD CLEAN PUBLIC LEADERBOARD
    ===================================================== */

    const publicLeaderboard =
      leaderboard.map(
        (team) => ({
          rank:
            team.rank,

          placement:
            team.placement,

          submission_id:
            team.submission_id,

          team_id:
            team.team_id,

          team_name:
            team.team_name,

          members:
            team.members,

          score:
            team.score,

          feedback:
            team.feedback,

          github_url:
            team.github_url,

          demo_url:
            team.demo_url,

          project_description:
            team.project_description,

          submission_status:
            team.submission_status,

          decision:
            team.decision,

          reviewed_at:
            team.reviewed_at,
        })
      );


    /* =====================================================
       17. SUCCESS
    ===================================================== */

    return res.status(200).json({
      success: true,

      message:
        "Result publication approved and results published successfully",

      request: {
        ...updatedRequest,

        hackathon_title:
          completedHackathon.title,
      },

      hackathon: {
        id:
          completedHackathon.id,

        title:
          completedHackathon.title,

        status:
          completedHackathon.status,

        current_round:
          completedHackathon.current_round,

        updated_at:
          completedHackathon.updated_at,
      },

      total_teams:
        publicLeaderboard.length,

      leaderboard:
        publicLeaderboard,
    });
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (
      rollbackError
    ) {
      console.error(
        "ROLLBACK ERROR:",
        rollbackError
      );
    }

    console.error(
      "APPROVE RESULT REQUEST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to approve and publish result",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  } finally {
    client.release();
  }
}


/* =========================================================
   REJECT RESULT PUBLICATION
========================================================= */

export async function rejectResultRequest(
  req,
  res
) {
  try {
    const {
      requestId,
    } = req.params;

    const {
      feedback,
    } = req.body;


    if (!requestId) {
      return res.status(400).json({
        success: false,

        message:
          "Request ID is required",
      });
    }


    /* =====================================================
       1. GET REQUEST
    ===================================================== */

    const requestResult =
      await pool.query(
        `
        SELECT
          id,
          hackathon_id,
          requested_by,
          status

        FROM result_requests

        WHERE id = $1
        `,
        [
          requestId,
        ]
      );


    if (
      requestResult.rows.length === 0
    ) {
      return res.status(404).json({
        success: false,

        message:
          "Result request not found",
      });
    }


    const request =
      requestResult.rows[0];


    /* =====================================================
       2. REQUEST MUST BE PENDING
    ===================================================== */

    if (
      request.status !==
      "PENDING"
    ) {
      return res.status(400).json({
        success: false,

        message:
          `Result request is already ${request.status}`,
      });
    }


    /* =====================================================
       3. REJECT
    ===================================================== */

    const updatedRequestResult =
      await pool.query(
        `
        UPDATE result_requests

        SET
          status = 'REJECTED',
          reviewed_by = $1,
          reviewed_at = NOW(),
          admin_feedback = $2,
          updated_at = NOW()

        WHERE id = $3

        RETURNING
          id,
          hackathon_id,
          requested_by,
          status,
          requested_at,
          reviewed_by,
          reviewed_at,
          admin_feedback
        `,
        [
          req.user.id,

          feedback &&
          String(feedback).trim()
            ? String(
                feedback
              ).trim()
            : "Result publication request rejected by Admin.",

          requestId,
        ]
      );


    const updatedRequest =
      updatedRequestResult
        .rows[0];


    /* =====================================================
       4. SUCCESS
    ===================================================== */

    return res.status(200).json({
      success: true,

      message:
        "Result publication request rejected successfully",

      request:
        updatedRequest,
    });
  } catch (error) {
    console.error(
      "REJECT RESULT REQUEST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to reject result request",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
}