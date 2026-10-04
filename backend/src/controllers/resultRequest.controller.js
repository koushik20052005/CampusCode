import pool from "../config/db.js";

// ============================================================
// REQUEST RESULT PUBLICATION
//
// Organizer finishes Round 3
//        ↓
// Organizer requests final result publication
//        ↓
// Admin reviews the request
//
// IMPORTANT:
// This controller does NOT publish results.
// Admin approval is required.
// ============================================================

export async function requestResultPublication(
  req,
  res
) {
  try {
    const { hackathonId } =
      req.params;

    // --------------------------------------------------------
    // Validate hackathon ID
    // --------------------------------------------------------

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message:
          "Hackathon ID is required",
      });
    }

    // --------------------------------------------------------
    // Only ORGANIZER can request publication
    // --------------------------------------------------------

    if (
      req.user.role !== "ORGANIZER"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only the hackathon organizer can request result publication",
      });
    }

    // --------------------------------------------------------
    // Get hackathon
    // --------------------------------------------------------

    const hackathonResult =
      await pool.query(
        `
        SELECT
          id,
          title,
          organizer_id,
          publication_status,
          current_round
        FROM hackathons
        WHERE id = $1
        LIMIT 1
        `,
        [hackathonId]
      );

    if (
      hackathonResult.rows.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Hackathon not found",
      });
    }

    const hackathon =
      hackathonResult.rows[0];

    // --------------------------------------------------------
    // Check organizer ownership
    // --------------------------------------------------------

    if (
      hackathon.organizer_id !==
      req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to request result publication for this hackathon",
      });
    }

    // --------------------------------------------------------
    // Hackathon must be published
    // --------------------------------------------------------

    if (
      hackathon.publication_status !==
      "PUBLISHED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Hackathon must be published before requesting results",
      });
    }

    // --------------------------------------------------------
    // Get Round 3
    // --------------------------------------------------------

    const roundResult =
      await pool.query(
        `
        SELECT
          id,
          round_number,
          title,
          status,
          start_at,
          end_at,
          activated_at,
          completed_at
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
      return res.status(400).json({
        success: false,
        message:
          "Round 3 has not been configured",
      });
    }

    const round =
      roundResult.rows[0];

    // --------------------------------------------------------
    // Round 3 must be completed
    // --------------------------------------------------------

    if (
      round.status !== "COMPLETED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Round 3 must be completed before requesting final results",
        current_round_status:
          round.status,
      });
    }

    // --------------------------------------------------------
    // Get Round 3 submission statistics
    //
    // This replaces the old:
    // evaluations → submissions → projects
    // flow.
    //
    // Round 3 is now the source of truth.
    // --------------------------------------------------------

    const round3StatsResult =
      await pool.query(
        `
        SELECT
          COUNT(*)::int AS total_submissions,

          COUNT(*) FILTER (
            WHERE decision = 'SELECTED'
          )::int AS selected_submissions,

          COUNT(*) FILTER (
            WHERE decision = 'REJECTED'
          )::int AS rejected_submissions,

          COUNT(*) FILTER (
            WHERE status = 'SUBMITTED'
          )::int AS pending_submissions,

          COUNT(*) FILTER (
            WHERE score IS NOT NULL
          )::int AS scored_submissions

        FROM round3_submissions
        WHERE hackathon_id = $1
        `,
        [hackathonId]
      );

    const stats =
      round3StatsResult.rows[0];

    const totalSubmissions =
      Number(
        stats.total_submissions || 0
      );

    const selectedSubmissions =
      Number(
        stats.selected_submissions || 0
      );

    const rejectedSubmissions =
      Number(
        stats.rejected_submissions || 0
      );

    const pendingSubmissions =
      Number(
        stats.pending_submissions || 0
      );

    const scoredSubmissions =
      Number(
        stats.scored_submissions || 0
      );

    // --------------------------------------------------------
    // At least one Round 3 submission required
    // --------------------------------------------------------

    if (
      totalSubmissions === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No Round 3 submissions are available for final results",
      });
    }

    // --------------------------------------------------------
    // Every submitted Round 3 project must be reviewed
    // before final results are requested.
    // --------------------------------------------------------

    if (
      pendingSubmissions > 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "All Round 3 submissions must be reviewed before requesting final results",

        statistics: {
          total_submissions:
            totalSubmissions,

          selected_submissions:
            selectedSubmissions,

          rejected_submissions:
            rejectedSubmissions,

          pending_submissions:
            pendingSubmissions,

          scored_submissions:
            scoredSubmissions,
        },
      });
    }

    // --------------------------------------------------------
    // Every submission must have a score
    // --------------------------------------------------------

    if (
      scoredSubmissions <
      totalSubmissions
    ) {
      return res.status(400).json({
        success: false,
        message:
          "All Round 3 submissions must have a score before requesting final results",

        statistics: {
          total_submissions:
            totalSubmissions,

          scored_submissions:
            scoredSubmissions,
        },
      });
    }

    // --------------------------------------------------------
    // At least one team must be selected
    // --------------------------------------------------------

    if (
      selectedSubmissions === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one Round 3 submission must be selected before requesting final results",
      });
    }

    // --------------------------------------------------------
    // Check existing result request
    // --------------------------------------------------------

    const existingRequestResult =
      await pool.query(
        `
        SELECT
          id,
          hackathon_id,
          requested_by,
          status,
          requested_at,
          reviewed_by,
          reviewed_at,
          admin_feedback
        FROM result_requests
        WHERE hackathon_id = $1
        ORDER BY
          requested_at DESC NULLS LAST,
          id DESC
        LIMIT 1
        `,
        [hackathonId]
      );

    if (
      existingRequestResult.rows
        .length > 0
    ) {
      const existingRequest =
        existingRequestResult.rows[0];

      // ------------------------------------------------------
      // Already pending
      // ------------------------------------------------------

      if (
        existingRequest.status ===
        "PENDING"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "A result publication request is already pending",
          request:
            existingRequest,
        });
      }

      // ------------------------------------------------------
      // Already approved
      // ------------------------------------------------------

      if (
        existingRequest.status ===
        "APPROVED"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Result publication has already been approved",
          request:
            existingRequest,
        });
      }
    }

    // --------------------------------------------------------
    // Create result request
    // --------------------------------------------------------

    const requestResult =
      await pool.query(
        `
        INSERT INTO result_requests (
          hackathon_id,
          requested_by,
          status,
          requested_at
        )
        VALUES (
          $1,
          $2,
          'PENDING',
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
          admin_feedback
        `,
        [
          hackathonId,
          req.user.id,
        ]
      );

    const request =
      requestResult.rows[0];

    // --------------------------------------------------------
    // Success
    // --------------------------------------------------------

    return res.status(201).json({
      success: true,

      message:
        "Result publication request submitted successfully. Waiting for admin approval.",

      request: {
        ...request,
        hackathon_title:
          hackathon.title,
      },

      statistics: {
        total_submissions:
          totalSubmissions,

        selected_submissions:
          selectedSubmissions,

        rejected_submissions:
          rejectedSubmissions,

        scored_submissions:
          scoredSubmissions,
      },
    });
  } catch (error) {
    console.error(
      "REQUEST RESULT PUBLICATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to request result publication",
      error: error.message,
    });
  }
}