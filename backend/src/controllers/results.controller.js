import pool from "../config/db.js";

// ============================================================
// GET HACKATHON RESULTS
//
// Results are visible to:
// STUDENT
// ORGANIZER
// ADMIN
//
// Students can only see them after the hackathon is completed.
// Organizer/Admin can preview them before publication.
// ============================================================

export async function getHackathonResults(req, res) {
  try {
    const { hackathonId } = req.params;

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message: "Hackathon ID is required",
      });
    }

    // --------------------------------------------------------
    // 1. Get hackathon
    // --------------------------------------------------------

    const hackathonResult = await pool.query(
      `
        SELECT
          id,
          title,
          track,
          status,
          current_round,
          organizer_id
        FROM hackathons
        WHERE id = $1
        LIMIT 1
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
    // 2. Determine access
    // --------------------------------------------------------

    const isAdmin = req.user.role === "ADMIN";

    const isOrganizer =
      req.user.role === "ORGANIZER" &&
      req.user.id === hackathon.organizer_id;

    const isPublished = hackathon.status === "COMPLETED";

    // --------------------------------------------------------
    // Students can only view after publication.
    // Organizer/Admin can preview.
    // --------------------------------------------------------

    if (!isPublished && !isAdmin && !isOrganizer) {
      return res.status(403).json({
        success: false,
        message: "Results have not been published yet",
      });
    }

    // --------------------------------------------------------
    // 3. Get Round 3 submissions
    // --------------------------------------------------------

    const result = await pool.query(
      `
        SELECT
          r3.id AS submission_id,
          r3.team_id,

          r3.github_url,
          r3.demo_url,
          r3.project_description,

          r3.status AS submission_status,
          r3.decision,
          r3.score,

          r3.organizer_feedback,

          r3.reviewed_by,
          r3.reviewed_at,

          t.name AS team_name,
          t.status AS team_status,

          (
            SELECT STRING_AGG(
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

        WHERE r3.hackathon_id = $1

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
      [hackathonId]
    );

    // --------------------------------------------------------
    // 4. Build final results
    // --------------------------------------------------------

    const selected = result.rows
      .filter(
        (row) =>
          row.decision === "SELECTED"
      )
      .sort((a, b) => {
        const scoreA = Number(a.score || 0);
        const scoreB = Number(b.score || 0);

        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }

        return String(a.team_name || "").localeCompare(
          String(b.team_name || "")
        );
      });

    const rejected = result.rows.filter(
      (row) =>
        row.decision === "REJECTED"
    );

    // --------------------------------------------------------
    // 5. Assign final ranks
    // --------------------------------------------------------

    const rankings = selected.map(
      (row, index) => ({
        rank: index + 1,

        placement:
          index === 0
            ? "WINNER"
            : "FINALIST",

        submission_id:
          row.submission_id,

        team_id:
          row.team_id,

        team_name:
          row.team_name,

        members:
          row.members
            ? row.members.split(", ")
            : [],

        score:
          Number(row.score || 0),

        // FIX:
        // Database column is organizer_feedback,
        // not feedback.
        feedback:
          row.organizer_feedback,

        github_url:
          row.github_url,

        demo_url:
          row.demo_url,

        project_description:
          row.project_description,

        submission_status:
          row.submission_status,

        decision:
          row.decision,

        reviewed_at:
          row.reviewed_at,
      })
    );

    // --------------------------------------------------------
    // 6. Preview information
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      published:
        isPublished,

      preview:
        !isPublished,

      hackathon: {
        id:
          hackathon.id,

        title:
          hackathon.title,

        track:
          hackathon.track,

        status:
          hackathon.status,

        current_round:
          hackathon.current_round,
      },

      summary: {
        total_submissions:
          result.rows.length,

        selected_teams:
          selected.length,

        rejected_teams:
          rejected.length,
      },

      results:
        rankings,
    });
  } catch (error) {
    console.error(
      "GET HACKATHON RESULTS ERROR:",
      error
    );

    console.error(
      "ERROR CODE:",
      error.code
    );

    console.error(
      "ERROR DETAIL:",
      error.detail
    );

    console.error(
      "ERROR MESSAGE:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch hackathon results",
    });
  }
}

// ============================================================
// PUBLISH HACKATHON RESULTS
//
// NOTE:
// Admin approval already publishes the hackathon.
//
// This endpoint is kept for compatibility with the existing
// results route, but it will NOT allow an organizer to bypass
// the Admin approval system.
//
// Required:
// result_requests.status = APPROVED
// ============================================================

export async function publishHackathonResults(req, res) {
  const client = await pool.connect();

  try {
    const { hackathonId } = req.params;

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message: "Hackathon ID is required",
      });
    }

    // --------------------------------------------------------
    // Only Admin can directly call this compatibility endpoint
    // --------------------------------------------------------

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message:
          "Only Admin can publish final results",
      });
    }

    await client.query("BEGIN");

    // --------------------------------------------------------
    // Get hackathon
    // --------------------------------------------------------

    const hackathonResult =
      await client.query(
        `
          SELECT
            id,
            title,
            status,
            organizer_id,
            current_round
          FROM hackathons
          WHERE id = $1
          FOR UPDATE
        `,
        [hackathonId]
      );

    if (
      hackathonResult.rows.length === 0
    ) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon =
      hackathonResult.rows[0];

    // --------------------------------------------------------
    // Already completed
    // --------------------------------------------------------

    if (
      hackathon.status ===
      "COMPLETED"
    ) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message:
          "Results are already published",
      });
    }

    // --------------------------------------------------------
    // Check approved result request
    // --------------------------------------------------------

    const requestResult =
      await client.query(
        `
          SELECT
            id,
            status,
            reviewed_by,
            reviewed_at,
            admin_feedback
          FROM result_requests
          WHERE hackathon_id = $1
            AND status = 'APPROVED'
          ORDER BY
            reviewed_at DESC NULLS LAST,
            id DESC
          LIMIT 1
        `,
        [hackathonId]
      );

    if (
      requestResult.rows.length === 0
    ) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message:
          "Results cannot be published without Admin approval",
      });
    }

    // --------------------------------------------------------
    // Verify Round 3
    // --------------------------------------------------------

    const roundResult =
      await client.query(
        `
          SELECT
            id,
            status
          FROM hackathon_rounds
          WHERE hackathon_id = $1
            AND round_number = 3
          LIMIT 1
        `,
        [hackathonId]
      );

    if (
      roundResult.rows.length === 0
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "Round 3 not found",
      });
    }

    if (
      roundResult.rows[0].status !==
      "COMPLETED"
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "Round 3 must be completed before publishing results",
      });
    }

    // --------------------------------------------------------
    // Mark hackathon completed
    // --------------------------------------------------------

    const updatedHackathonResult =
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
            updated_at
        `,
        [hackathonId]
      );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,

      message:
        "Hackathon results published successfully",

      published: true,

      hackathon:
        updatedHackathonResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "PUBLISH HACKATHON RESULTS ERROR:",
      error
    );

    console.error(
      "ERROR CODE:",
      error.code
    );

    console.error(
      "ERROR DETAIL:",
      error.detail
    );

    console.error(
      "ERROR MESSAGE:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to publish hackathon results",
    });
  } finally {
    client.release();
  }
}