import pool from "../config/db.js";

/* ============================================================
   GET PENDING RESULT REQUESTS
   GET /api/admin/results/pending
============================================================ */

export async function getPendingResultRequests(req, res) {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const result = await pool.query(`
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
        h.status AS hackathon_status,
        h.current_round,
        h.organizer_id,

        u.name AS organizer_name,
        u.email AS organizer_email,

        (
          SELECT COUNT(*)::int
          FROM round3_submissions r3
          WHERE r3.hackathon_id = h.id
        ) AS total_round3_submissions,

        (
          SELECT COUNT(*)::int
          FROM round3_submissions r3
          WHERE r3.hackathon_id = h.id
            AND r3.decision = 'SELECTED'
        ) AS selected_teams,

        (
          SELECT COUNT(*)::int
          FROM round3_submissions r3
          WHERE r3.hackathon_id = h.id
            AND r3.decision = 'REJECTED'
        ) AS rejected_teams,

        (
          SELECT COUNT(*)::int
          FROM round3_submissions r3
          WHERE r3.hackathon_id = h.id
            AND r3.decision IS NULL
        ) AS pending_reviews

      FROM result_requests rr

      INNER JOIN hackathons h
        ON h.id = rr.hackathon_id

      INNER JOIN users u
        ON u.id = rr.requested_by

      WHERE rr.status = 'PENDING'

      ORDER BY rr.requested_at ASC
    `);

    return res.status(200).json({
      success: true,
      total_requests: result.rows.length,
      requests: result.rows,
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
    });
  }
}


/* ============================================================
   APPROVE RESULT REQUEST

   Admin approval:

   PENDING
      ↓
   APPROVED
      ↓
   Hackathon COMPLETED

   Final rankings come from Round 3 scores.
============================================================ */

export async function approveResultRequest(req, res) {
  const client = await pool.connect();

  try {
    const { requestId } = req.params;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required",
      });
    }

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    await client.query("BEGIN");


    /* ========================================================
       1. GET RESULT REQUEST
    ======================================================== */

    const requestResult = await client.query(
      `
      SELECT
        id,
        hackathon_id,
        requested_by,
        status
      FROM result_requests
      WHERE id = $1
      FOR UPDATE
      `,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Result request not found",
      });
    }

    const request = requestResult.rows[0];


    /* ========================================================
       2. REQUEST MUST BE PENDING
    ======================================================== */

    if (request.status !== "PENDING") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message:
          `Result request is already ${request.status}`,
        current_status: request.status,
      });
    }


    /* ========================================================
       3. GET HACKATHON
    ======================================================== */

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
        [request.hackathon_id]
      );

    if (hackathonResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon =
      hackathonResult.rows[0];


    /* ========================================================
       4. VERIFY ROUND 3 EXISTS AND IS COMPLETED
    ======================================================== */

    const roundResult =
      await client.query(
        `
        SELECT
          id,
          status,
          completed_at
        FROM hackathon_rounds
        WHERE hackathon_id = $1
          AND round_number = 3
        LIMIT 1
        `,
        [request.hackathon_id]
      );

    if (roundResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Round 3 not found",
      });
    }

    const round3 =
      roundResult.rows[0];

    if (round3.status !== "COMPLETED") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "Round 3 must be completed before results can be approved",
        round_status: round3.status,
      });
    }


    /* ========================================================
       5. GET FINAL ROUND 3 SUBMISSIONS

       Round 3 is the source of truth.
    ======================================================== */

    const leaderboardResult =
      await client.query(
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

          /* FIX:
             Round 3 uses organizer_feedback,
             NOT feedback.
          */
          r3.organizer_feedback,

          r3.reviewed_by,
          r3.reviewed_at,

          t.name AS team_name,
          t.status AS current_team_status

        FROM round3_submissions r3

        INNER JOIN teams t
          ON t.id = r3.team_id

        WHERE r3.hackathon_id = $1

        ORDER BY
          r3.score DESC NULLS LAST,
          r3.reviewed_at ASC NULLS LAST,
          t.name ASC
        `,
        [request.hackathon_id]
      );

    const submissions =
      leaderboardResult.rows;


    /* ========================================================
       6. VALIDATE ROUND 3 SUBMISSIONS
    ======================================================== */

    if (submissions.length === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "No Round 3 submissions found",
      });
    }


    /* ========================================================
       EVERY SUBMISSION MUST BE REVIEWED
    ======================================================== */

    const pendingSubmissions =
      submissions.filter(
        (item) =>
          item.decision === null ||
          item.decision === undefined
      );

    if (pendingSubmissions.length > 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "All Round 3 submissions must be reviewed before approving results",

        pending_submissions:
          pendingSubmissions.length,
      });
    }


    /* ========================================================
       EVERY SUBMISSION MUST HAVE A SCORE
    ======================================================== */

    const unscoredSubmissions =
      submissions.filter(
        (item) =>
          item.score === null ||
          item.score === undefined
      );

    if (
      unscoredSubmissions.length > 0
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "All Round 3 submissions must have a score before approving results",

        unscored_submissions:
          unscoredSubmissions.length,
      });
    }


    /* ========================================================
       AT LEAST ONE SELECTED TEAM
    ======================================================== */

    const selectedTeams =
      submissions.filter(
        (item) =>
          item.decision === "SELECTED"
      );

    if (selectedTeams.length === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "At least one Round 3 team must be selected before approving results",
      });
    }


    /* ========================================================
       7. BUILD FINAL RANKING

       Only SELECTED teams receive final placements.

       REJECTED teams remain rejected.
    ======================================================== */

    selectedTeams.sort((a, b) => {
      const scoreA =
        Number(a.score);

      const scoreB =
        Number(b.score);

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      const dateA = a.reviewed_at
        ? new Date(
            a.reviewed_at
          ).getTime()
        : Number.MAX_SAFE_INTEGER;

      const dateB = b.reviewed_at
        ? new Date(
            b.reviewed_at
          ).getTime()
        : Number.MAX_SAFE_INTEGER;

      if (dateA !== dateB) {
        return dateA - dateB;
      }

      return String(
        a.team_name || ""
      ).localeCompare(
        String(
          b.team_name || ""
        )
      );
    });


    /* ========================================================
       8. ASSIGN FINAL PLACEMENTS

       1 → WINNER
       2 → FINALIST
       3 → FINALIST
       Others → FINALIST

       Existing teams.status supports:
       BUILDING
       SUBMITTED
       FINALIST
       WINNER
       DISQUALIFIED
    ======================================================== */

    const leaderboard =
      selectedTeams.map(
        (team, index) => ({
          ...team,

          rank:
            index + 1,

          placement:
            index === 0
              ? "WINNER"
              : "FINALIST",

          score:
            Number(team.score),
        })
      );


    /* ========================================================
       9. UPDATE TEAM STATUSES
    ======================================================== */

    for (const team of leaderboard) {
      const newStatus =
        team.rank === 1
          ? "WINNER"
          : "FINALIST";

      await client.query(
        `
        UPDATE teams
        SET
          status = $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [
          newStatus,
          team.team_id,
        ]
      );
    }


    /* ========================================================
       10. MARK HACKATHON COMPLETED
    ======================================================== */

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
          /* FIX:
             request contains hackathon_id,
             not hackathonId.
          */
          request.hackathon_id,
        ]
      );

    const completedHackathon =
      completedHackathonResult.rows[0];


    /* ========================================================
       11. APPROVE RESULT REQUEST
    ======================================================== */

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
          admin_feedback,
          created_at,
          updated_at
        `,
        [
          req.user.id,

          "Result publication approved by Admin.",

          requestId,
        ]
      );

    const updatedRequest =
      updatedRequestResult.rows[0];


    /* ========================================================
       12. COMMIT
    ======================================================== */

    await client.query("COMMIT");


    /* ========================================================
       13. RESPONSE
    ======================================================== */

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

      total_selected:
        leaderboard.length,

      leaderboard,
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "APPROVE RESULT REQUEST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to approve and publish result",

      error:
        error.message,
    });

  } finally {
    client.release();
  }
}


/* ============================================================
   REJECT RESULT REQUEST

   Admin rejects organizer request.

   Results are NOT published.
============================================================ */

export async function rejectResultRequest(
  req,
  res
) {
  try {
    const { requestId } =
      req.params;

    const { feedback } =
      req.body;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required",
      });
    }

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }


    /* ========================================================
       GET REQUEST
    ======================================================== */

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
        [requestId]
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


    /* ========================================================
       REQUEST MUST BE PENDING
    ======================================================== */

    if (
      request.status !== "PENDING"
    ) {
      return res.status(409).json({
        success: false,
        message:
          `Result request is already ${request.status}`,

        current_status:
          request.status,
      });
    }


    /* ========================================================
       FEEDBACK
    ======================================================== */

    const adminFeedback =
      typeof feedback === "string" &&
      feedback.trim().length > 0
        ? feedback.trim()
        : "Result publication request rejected by Admin.";


    /* ========================================================
       REJECT
    ======================================================== */

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
          admin_feedback,
          created_at,
          updated_at
        `,
        [
          req.user.id,
          adminFeedback,
          requestId,
        ]
      );


    return res.status(200).json({
      success: true,

      message:
        "Result publication request rejected successfully",

      request:
        updatedRequestResult.rows[0],
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
        error.message,
    });
  }
}