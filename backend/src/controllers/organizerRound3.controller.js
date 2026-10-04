import pool from "../config/db.js";

// ============================================================
// HELPER — CHECK ORGANIZER / ADMIN ACCESS
// ============================================================

const checkOrganizerAccess = async (
  hackathonId,
  userId,
  userRole
) => {
  const result = await pool.query(
    `
    SELECT
      id,
      organizer_id,
      title,
      publication_status,
      current_round
    FROM hackathons
    WHERE id = $1
    LIMIT 1
    `,
    [hackathonId]
  );

  if (result.rows.length === 0) {
    return {
      error: "Hackathon not found",
      status: 404,
    };
  }

  const hackathon = result.rows[0];

  // Admin can manage all hackathons
  if (userRole === "ADMIN") {
    return {
      hackathon,
    };
  }

  // Organizer can manage only their own hackathons
  if (
    userRole !== "ORGANIZER" ||
    hackathon.organizer_id !== userId
  ) {
    return {
      error:
        "You do not have permission to manage this hackathon",
      status: 403,
    };
  }

  return {
    hackathon,
  };
};


// ============================================================
// GET ROUND 3 SUBMISSIONS
// GET /api/organizer/round3/hackathons/:hackathonId/submissions
// ============================================================

export const getRound3Submissions = async (
  req,
  res
) => {
  try {
    const { hackathonId } = req.params;

    const userId = req.user.id;
    const userRole = req.user.role;

    // --------------------------------------------------------
    // Check access
    // --------------------------------------------------------

    const access =
      await checkOrganizerAccess(
        hackathonId,
        userId,
        userRole
      );

    if (access.error) {
      return res.status(access.status).json({
        success: false,
        message: access.error,
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
          start_at,
          end_at,
          status,
          activated_at,
          completed_at
        FROM hackathon_rounds
        WHERE hackathon_id = $1
          AND round_number = 3
        LIMIT 1
        `,
        [hackathonId]
      );

    if (roundResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Round 3 has not been configured",
      });
    }

    const round =
      roundResult.rows[0];

    // --------------------------------------------------------
    // Get Round 3 submissions
    // --------------------------------------------------------

    const submissionsResult =
      await pool.query(
        `
        SELECT
          r3.id,
          r3.hackathon_id,
          r3.team_id,
          r3.submitted_by,

          r3.github_url,
          r3.demo_url,
          r3.project_description,

          r3.status,
          r3.decision,
          r3.score,
          r3.organizer_feedback,

          r3.submitted_at,
          r3.reviewed_at,
          r3.reviewed_by,

          t.name AS team_name,
          t.leader_id,

          u.name AS submitted_by_name,
          u.email AS submitted_by_email,

          reviewer.name AS reviewer_name

        FROM round3_submissions r3

        INNER JOIN teams t
          ON t.id = r3.team_id

        INNER JOIN users u
          ON u.id = r3.submitted_by

        LEFT JOIN users reviewer
          ON reviewer.id = r3.reviewed_by

        WHERE r3.hackathon_id = $1

        ORDER BY
          r3.score DESC NULLS LAST,
          r3.submitted_at ASC
        `,
        [hackathonId]
      );

    return res.status(200).json({
      success: true,

      hackathon: access.hackathon,

      round: {
        id: round.id,
        round_number: round.round_number,
        title: round.title,
        start_at: round.start_at,
        end_at: round.end_at,
        status: round.status,
        activated_at: round.activated_at,
        completed_at: round.completed_at,
      },

      total_submissions:
        submissionsResult.rows.length,

      submissions:
        submissionsResult.rows,
    });
  } catch (error) {
    console.error(
      "Get Round 3 submissions error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get Round 3 submissions",
      error: error.message,
    });
  }
};


// ============================================================
// REVIEW ROUND 3 SUBMISSION
//
// PATCH
// /api/organizer/round3/submissions/:submissionId/review
// ============================================================

export const reviewRound3Submission =
  async (req, res) => {
    try {
      const { submissionId } =
        req.params;

      const userId = req.user.id;
      const userRole = req.user.role;

      // ======================================================
      // IMPORTANT:
      // Frontend currently sends:
      //
      // {
      //   decision,
      //   score,
      //   organizer_feedback
      // }
      //
      // Older clients may send:
      //
      // {
      //   decision,
      //   score,
      //   feedback
      // }
      //
      // Accept both names.
      // ======================================================

      const {
        decision,
        score,
        feedback,
        organizer_feedback,
      } = req.body;

      // ------------------------------------------------------
      // Normalize organizer feedback
      // ------------------------------------------------------

      const organizerFeedback =
        typeof organizer_feedback === "string"
          ? organizer_feedback.trim()
          : typeof feedback === "string"
            ? feedback.trim()
            : "";

      // ------------------------------------------------------
      // Validate decision
      // ------------------------------------------------------

      const normalizedDecision =
        String(decision || "")
          .trim()
          .toUpperCase();

      if (
        ![
          "SELECTED",
          "REJECTED",
        ].includes(
          normalizedDecision
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Decision must be SELECTED or REJECTED",
        });
      }

      // ------------------------------------------------------
      // Validate score
      // ------------------------------------------------------

      if (
        score === undefined ||
        score === null ||
        score === ""
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Score is required",
        });
      }

      const numericScore =
        Number(score);

      if (
        Number.isNaN(numericScore) ||
        numericScore < 0 ||
        numericScore > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Score must be between 0 and 100",
        });
      }

      // ------------------------------------------------------
      // Validate feedback
      // ------------------------------------------------------

      if (!organizerFeedback) {
        return res.status(400).json({
          success: false,
          message:
            "Organizer feedback is required",
        });
      }

      // ------------------------------------------------------
      // Get submission + hackathon
      // ------------------------------------------------------

      const submissionResult =
        await pool.query(
          `
          SELECT
            r3.id,
            r3.hackathon_id,
            r3.team_id,
            r3.status,
            r3.decision,

            h.organizer_id,
            h.title,
            h.current_round,

            r.status AS round_status

          FROM round3_submissions r3

          INNER JOIN hackathons h
            ON h.id = r3.hackathon_id

          INNER JOIN hackathon_rounds r
            ON r.hackathon_id = r3.hackathon_id
           AND r.round_number = 3

          WHERE r3.id = $1

          LIMIT 1
          `,
          [submissionId]
        );

      if (
        submissionResult.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Round 3 submission not found",
        });
      }

      const submission =
        submissionResult.rows[0];

      // ------------------------------------------------------
      // Organizer permission
      // ------------------------------------------------------

      if (
        userRole !== "ADMIN" &&
        (
          userRole !== "ORGANIZER" ||
          submission.organizer_id !==
            userId
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to review this submission",
        });
      }

      // ------------------------------------------------------
      // Prevent changing an already rejected submission
      // ------------------------------------------------------

      if (
        submission.status === "REJECTED" ||
        submission.decision === "REJECTED"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This submission has already been rejected",
        });
      }

      // ------------------------------------------------------
      // Get previous review
      // ------------------------------------------------------

      const previousReviewResult =
        await pool.query(
          `
          SELECT
            id,
            decision,
            score,
            organizer_feedback,
            reviewed_by,
            reviewed_at
          FROM round3_submissions
          WHERE id = $1
          `,
          [submissionId]
        );

      const previousReview =
        previousReviewResult.rows[0] ||
        null;

      // ------------------------------------------------------
      // Selected submissions remain REVIEWED
      // Rejected submissions become REJECTED
      // ------------------------------------------------------

      const submissionStatus =
        normalizedDecision ===
        "SELECTED"
          ? "REVIEWED"
          : "REJECTED";

      // ------------------------------------------------------
      // Update review
      // ------------------------------------------------------

      const updatedResult =
        await pool.query(
          `
          UPDATE round3_submissions
          SET
            status = $1,
            decision = $2,
            score = $3,
            organizer_feedback = $4,
            reviewed_by = $5,
            reviewed_at = NOW(),
            updated_at = NOW()
          WHERE id = $6

          RETURNING
            id,
            hackathon_id,
            team_id,
            submitted_by,
            github_url,
            demo_url,
            project_description,
            status,
            decision,
            score,
            organizer_feedback,
            submitted_at,
            reviewed_at,
            reviewed_by
          `,
          [
            submissionStatus,
            normalizedDecision,
            numericScore,
            organizerFeedback,
            userId,
            submissionId,
          ]
        );

      const updatedSubmission =
        updatedResult.rows[0];

      // ------------------------------------------------------
      // IMPORTANT
      //
      // Do NOT:
      // - declare winner here
      // - modify hackathon.current_round here
      // - publish results here
      // - bypass admin result approval
      //
      // Round 3 review only records organizer evaluation.
      // ------------------------------------------------------

      return res.status(200).json({
        success: true,

        message:
          normalizedDecision ===
          "SELECTED"
            ? "Round 3 submission selected successfully."
            : "Round 3 submission rejected.",

        decision:
          normalizedDecision,

        submission:
          updatedSubmission,

        previous_review:
          previousReview,
      });
    } catch (error) {
      console.error(
        "Review Round 3 submission error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to review Round 3 submission",
        error: error.message,
      });
    }
  };