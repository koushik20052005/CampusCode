import pool from "../config/db.js";

// ============================================================
// GET PUBLISHED HACKATHON RESULTS
// GET /api/student/results/:hackathonId
// ============================================================

export const getStudentResults = async (req, res) => {
  try {
    const { hackathonId } = req.params;

    // --------------------------------------------------------
    // 1. Check hackathon
    // --------------------------------------------------------

    const hackathonResult = await pool.query(
      `
      SELECT
        id,
        title,
        description,
        organizer_id,
        publication_status,
        current_round,
        status
      FROM hackathons
      WHERE id = $1
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

    // --------------------------------------------------------
    // 2. Check result publication approval
    // --------------------------------------------------------

    const requestResult = await pool.query(
      `
      SELECT
        rr.id,
        rr.status,
        rr.requested_at,
        rr.reviewed_at,
        rr.admin_feedback,

        u.name AS admin_name

      FROM result_requests rr

      LEFT JOIN users u
        ON u.id = rr.reviewed_by

      WHERE rr.hackathon_id = $1
        AND rr.status = 'APPROVED'

      ORDER BY rr.reviewed_at DESC

      LIMIT 1
      `,
      [hackathonId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Results have not been published yet",
      });
    }

    const resultRequest = requestResult.rows[0];

    // --------------------------------------------------------
    // 3. Get final leaderboard
    // --------------------------------------------------------

    const leaderboardResult = await pool.query(
      `
      SELECT
        r3.id AS submission_id,
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

        u.name AS leader_name

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
    // 4. Create rankings
    // --------------------------------------------------------

    const leaderboard = leaderboardResult.rows.map(
      (submission, index) => ({
        rank: index + 1,

        submission_id:
          submission.submission_id,

        team_id:
          submission.team_id,

        team_name:
          submission.team_name,

        leader_name:
          submission.leader_name,

        score:
          Number(submission.score),

        github_url:
          submission.github_url,

        demo_url:
          submission.demo_url,

        project_description:
          submission.project_description,

        decision:
          submission.decision,

        status:
          submission.status,

        organizer_feedback:
          submission.organizer_feedback,

        submitted_at:
          submission.submitted_at,

        reviewed_at:
          submission.reviewed_at,
      })
    );

    // --------------------------------------------------------
    // 5. Winners
    // --------------------------------------------------------

    const winners = leaderboard
      .slice(0, 3)
      .map((item, index) => ({
        position: index + 1,
        rank: item.rank,
        team_id: item.team_id,
        team_name: item.team_name,
        score: item.score,
      }));

    // --------------------------------------------------------
    // 6. Response
    // --------------------------------------------------------

    return res.json({
      success: true,

      results_published: true,

      published_at:
        resultRequest.reviewed_at,

      hackathon: {
        id: hackathon.id,
        title: hackathon.title,
        description: hackathon.description,
        status: hackathon.status,
        publication_status:
          hackathon.publication_status,
        current_round:
          hackathon.current_round,
      },

      result_request: {
        id: resultRequest.id,
        status: resultRequest.status,
        reviewed_at:
          resultRequest.reviewed_at,
        admin_feedback:
          resultRequest.admin_feedback,
      },

      total_winners:
        leaderboard.length,

      winners,

      leaderboard,
    });
  } catch (error) {
    console.error(
      "Get student results error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get hackathon results",
      error: error.message,
    });
  }
};