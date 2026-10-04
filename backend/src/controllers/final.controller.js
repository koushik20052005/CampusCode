import pool from "../config/db.js";

// ============================================================
// HELPER — CHECK ORGANIZER ACCESS
// ============================================================

const checkOrganizerAccess = async (
  client,
  hackathonId,
  userId,
  userRole
) => {
  const result = await client.query(
    `
    SELECT
      id,
      organizer_id,
      title,
      publication_status,
      current_round
    FROM hackathons
    WHERE id = $1
    `,
    [hackathonId]
  );

  if (result.rows.length === 0) {
    return {
      allowed: false,
      status: 404,
      message: "Hackathon not found",
    };
  }

  const hackathon = result.rows[0];

  if (
    userRole !== "ADMIN" &&
    hackathon.organizer_id !== userId
  ) {
    return {
      allowed: false,
      status: 403,
      message: "You are not authorized to manage this hackathon",
    };
  }

  return {
    allowed: true,
    hackathon,
  };
};

// ============================================================
// GET FINAL LEADERBOARD
// GET /api/organizer/final/hackathons/:hackathonId/leaderboard
// ============================================================

export const getFinalLeaderboard = async (req, res) => {
  const client = await pool.connect();

  try {
    const { hackathonId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // --------------------------------------------------------
    // 1. Check organizer access
    // --------------------------------------------------------

    const access = await checkOrganizerAccess(
      client,
      hackathonId,
      userId,
      userRole
    );

    if (!access.allowed) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const hackathon = access.hackathon;

    // --------------------------------------------------------
    // 2. Get Round 3
    // --------------------------------------------------------

    const roundResult = await client.query(
      `
      SELECT
        id,
        round_number,
        title,
        status,
        start_at,
        end_at,
        completed_at
      FROM hackathon_rounds
      WHERE hackathon_id = $1
        AND round_number = 3
      `,
      [hackathonId]
    );

    if (roundResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Round 3 not found",
      });
    }

    const round = roundResult.rows[0];

    // --------------------------------------------------------
    // 3. Get selected submissions
    // --------------------------------------------------------

    const submissionsResult = await client.query(
      `
      SELECT
        r3.id AS submission_id,
        r3.hackathon_id,
        r3.team_id,
        r3.github_url,
        r3.demo_url,
        r3.project_description,
        r3.score,
        r3.decision,
        r3.status,
        r3.organizer_feedback,
        r3.submitted_at,
        r3.reviewed_at,

        t.name AS team_name,
        t.leader_id,

        u.id AS leader_id,
        u.name AS leader_name,
        u.email AS leader_email

      FROM round3_submissions r3

      INNER JOIN teams t
        ON t.id = r3.team_id

      LEFT JOIN users u
        ON u.id = t.leader_id

      WHERE r3.hackathon_id = $1
        AND r3.decision = 'SELECTED'
        AND r3.score IS NOT NULL

      ORDER BY
        r3.score DESC,
        r3.reviewed_at ASC,
        r3.submitted_at ASC
      `,
      [hackathonId]
    );

    // --------------------------------------------------------
    // 4. Format leaderboard
    // --------------------------------------------------------

    const leaderboard = submissionsResult.rows.map(
      (submission, index) => ({
        rank: index + 1,
        submission_id: submission.submission_id,
        team_id: submission.team_id,
        team_name: submission.team_name,

        leader: {
          id: submission.leader_id,
          name: submission.leader_name,
          email: submission.leader_email,
        },

        github_url: submission.github_url,
        demo_url: submission.demo_url,
        project_description:
          submission.project_description,

        score: Number(submission.score),

        decision: submission.decision,
        status: submission.status,

        organizer_feedback:
          submission.organizer_feedback,

        submitted_at: submission.submitted_at,
        reviewed_at: submission.reviewed_at,
      })
    );

    // --------------------------------------------------------
    // 5. Top 3 winners
    // --------------------------------------------------------

    const winners = leaderboard
      .slice(0, 3)
      .map((item, index) => ({
        position: index + 1,
        rank: item.rank,
        team_id: item.team_id,
        team_name: item.team_name,
        score: item.score,
        submission_id: item.submission_id,
      }));

    // --------------------------------------------------------
    // 6. Response
    // --------------------------------------------------------

    return res.json({
      success: true,

      hackathon: {
        id: hackathon.id,
        organizer_id: hackathon.organizer_id,
        title: hackathon.title,
        publication_status:
          hackathon.publication_status,
        current_round: hackathon.current_round,
      },

      round: {
        id: round.id,
        round_number: round.round_number,
        title: round.title,
        status: round.status,
        start_at: round.start_at,
        end_at: round.end_at,
        completed_at: round.completed_at,
      },

      total_selected: leaderboard.length,

      winners,

      leaderboard,
    });
  } catch (error) {
    console.error(
      "Get final leaderboard error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get final leaderboard",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// ============================================================
// REQUEST RESULT PUBLICATION
// POST /api/organizer/final/hackathons/:hackathonId/request-results
// ============================================================

export const requestResultPublication = async (req, res) => {
  const client = await pool.connect();

  try {
    const { hackathonId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // --------------------------------------------------------
    // 1. Check organizer access
    // --------------------------------------------------------

    const access = await checkOrganizerAccess(
      client,
      hackathonId,
      userId,
      userRole
    );

    if (!access.allowed) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const hackathon = access.hackathon;

    // --------------------------------------------------------
    // 2. Get Round 3
    // --------------------------------------------------------

    const roundResult = await client.query(
      `
      SELECT
        id,
        round_number,
        title,
        status,
        start_at,
        end_at,
        completed_at
      FROM hackathon_rounds
      WHERE hackathon_id = $1
        AND round_number = 3
      `,
      [hackathonId]
    );

    if (roundResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Round 3 has not been scheduled",
      });
    }

    const round3 = roundResult.rows[0];

    // --------------------------------------------------------
    // 3. Round 3 must be completed
    // --------------------------------------------------------

    if (round3.status !== "COMPLETED") {
      return res.status(400).json({
        success: false,
        message:
          "Round 3 must be completed before requesting result publication",
        round_status: round3.status,
      });
    }

    // --------------------------------------------------------
    // 4. Check selected submissions
    // --------------------------------------------------------

    const selectedResult = await client.query(
      `
      SELECT COUNT(*)::int AS total_selected
      FROM round3_submissions
      WHERE hackathon_id = $1
        AND decision = 'SELECTED'
        AND score IS NOT NULL
      `,
      [hackathonId]
    );

    const totalSelected =
      selectedResult.rows[0].total_selected;

    if (totalSelected === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No selected final submissions are available for result publication",
      });
    }

    // --------------------------------------------------------
    // 5. Check existing result request
    // --------------------------------------------------------

    const existingRequestResult = await client.query(
      `
      SELECT
        id,
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        admin_feedback
      FROM result_requests
      WHERE hackathon_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [hackathonId]
    );

    if (existingRequestResult.rows.length > 0) {
      const existingRequest =
        existingRequestResult.rows[0];

      if (
        existingRequest.status === "PENDING" ||
        existingRequest.status === "APPROVED"
      ) {
        return res.status(409).json({
          success: false,
          message: `A result publication request already exists with status ${existingRequest.status}`,
          request: existingRequest,
        });
      }
    }

    // --------------------------------------------------------
    // 6. Create request
    // --------------------------------------------------------

    const requestResult = await client.query(
      `
      INSERT INTO result_requests (
        hackathon_id,
        requested_by,
        status,
        requested_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        'PENDING',
        NOW(),
        NOW(),
        NOW()
      )
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
      [hackathonId, userId]
    );

    return res.status(201).json({
      success: true,
      message:
        "Result publication request submitted successfully",

      request: requestResult.rows[0],

      summary: {
        hackathon_id: hackathonId,
        round: 3,
        total_selected: totalSelected,
        request_status: "PENDING",
      },
    });
  } catch (error) {
    console.error(
      "Request result publication error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to request result publication",
      error: error.message,
    });
  } finally {
    client.release();
  }
};