import pool from "../config/db.js";

/* =========================================================
   CHECK ROUND 3 TEAM ACCESS
========================================================= */

async function getRound3TeamAccess(
  hackathonId,
  teamId,
  user
) {
  const result = await pool.query(
    `SELECT
       t.id AS team_id,
       t.name AS team_name,
       t.status AS team_status,
       t.hackathon_id,

       h.title AS hackathon_title,
       h.current_round,
       h.organizer_id

     FROM teams t

     JOIN hackathons h
       ON h.id = t.hackathon_id

     WHERE t.id = $1
       AND t.hackathon_id = $2`,
    [
      teamId,
      hackathonId,
    ]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const team = result.rows[0];

  /* -----------------------------------------------------
     ADMIN ACCESS
  ----------------------------------------------------- */

  if (user.role === "ADMIN") {
    return team;
  }

  /* -----------------------------------------------------
     ORGANIZER ACCESS
  ----------------------------------------------------- */

  if (
    user.role === "ORGANIZER" &&
    team.organizer_id === user.id
  ) {
    return team;
  }

  return false;
}

/* =========================================================
   SUBMIT ROUND 3 FINAL EVALUATION
========================================================= */

export async function evaluateRound3(
  req,
  res
) {
  try {
    const {
      hackathonId,
      teamId,
    } = req.params;

    const {
      problem_relevance,
      innovation,
      technical_depth,
      impact,
      feedback,
    } = req.body;

    /* -----------------------------------------------------
       VALIDATE IDS
    ----------------------------------------------------- */

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message:
          "Hackathon ID is required",
      });
    }

    if (!teamId) {
      return res.status(400).json({
        success: false,
        message:
          "Team ID is required",
      });
    }

    /* -----------------------------------------------------
       VALIDATE SCORES
    ----------------------------------------------------- */

    const scores = {
      problem_relevance,
      innovation,
      technical_depth,
      impact,
    };

    for (
      const [field, value]
      of Object.entries(scores)
    ) {
      const numericValue =
        Number(value);

      if (
        !Number.isInteger(
          numericValue
        ) ||
        numericValue < 0 ||
        numericValue > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${field} must be an integer between 0 and 100`,
        });
      }
    }

    /* -----------------------------------------------------
       VALIDATE FEEDBACK
    ----------------------------------------------------- */

    if (
      !feedback ||
      typeof feedback !== "string" ||
      !feedback.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Final evaluation feedback is required",
      });
    }

    /* -----------------------------------------------------
       CHECK TEAM ACCESS
    ----------------------------------------------------- */

    const team =
      await getRound3TeamAccess(
        hackathonId,
        teamId,
        req.user
      );

    if (team === null) {
      return res.status(404).json({
        success: false,
        message:
          "Team not found in this hackathon",
      });
    }

    if (team === false) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to evaluate this team",
      });
    }

    /* -----------------------------------------------------
       CHECK CURRENT ROUND
    ----------------------------------------------------- */

    if (
      team.current_round !== 3
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Round 3 evaluation is not available because the hackathon is currently on Round ${team.current_round}`,
      });
    }

    /* -----------------------------------------------------
       VERIFY ROUND 2 SELECTION
    ----------------------------------------------------- */

    const round2DecisionResult =
      await pool.query(
        `SELECT
           decision
         FROM round2_decisions

         WHERE hackathon_id = $1
           AND team_id = $2

         ORDER BY decided_at DESC
         LIMIT 1`,
        [
          hackathonId,
          teamId,
        ]
      );

    if (
      round2DecisionResult.rows.length ===
      0
    ) {
      return res.status(403).json({
        success: false,
        message:
          "This team does not have a Round 2 decision",
      });
    }

    const round2Decision =
      round2DecisionResult.rows[0]
        .decision;

    if (
      round2Decision !== "SELECTED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "This team was not selected for Round 3",
      });
    }

    /* -----------------------------------------------------
       GET ORIGINAL SUBMISSION
       
       IMPORTANT:
       evaluations.submission_id references
       submissions(id), NOT round2_submissions(id).
    ----------------------------------------------------- */

    const submissionResult =
      await pool.query(
        `SELECT
           s.id,
           s.status,
           p.id AS project_id

         FROM submissions s

         JOIN projects p
           ON p.id = s.project_id

         WHERE p.team_id = $1

         ORDER BY s.created_at DESC
         LIMIT 1`,
        [teamId]
      );

    if (
      submissionResult.rows.length ===
      0
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Original project submission not found for this team",
      });
    }

    const originalSubmission =
      submissionResult.rows[0];

    const submissionId =
      originalSubmission.id;

    /* -----------------------------------------------------
       CALCULATE FINAL SCORE
    ----------------------------------------------------- */

    const finalScore =
      (
        Number(problem_relevance) +
        Number(innovation) +
        Number(technical_depth) +
        Number(impact)
      ) / 4;

    /* -----------------------------------------------------
       CHECK EXISTING EVALUATION
    ----------------------------------------------------- */

    const existingEvaluation =
      await pool.query(
        `SELECT
           id,
           submission_id,
           evaluator_id,
           overall_score,
           status
         FROM evaluations

         WHERE submission_id = $1
           AND evaluator_id = $2

         LIMIT 1`,
        [
          submissionId,
          req.user.id,
        ]
      );

    /* -----------------------------------------------------
       CREATE / UPDATE EVALUATION
    ----------------------------------------------------- */

    let evaluation;

    if (
      existingEvaluation.rows.length >
      0
    ) {
      const updateResult =
        await pool.query(
          `UPDATE evaluations
           SET
             problem_relevance = $1,
             innovation = $2,
             technical_depth = $3,
             impact = $4,
             overall_score = $5,
             feedback = $6,
             status = 'COMPLETED',
             updated_at = NOW()

           WHERE id = $7

           RETURNING
             id,
             submission_id,
             evaluator_id,
             problem_relevance,
             innovation,
             technical_depth,
             impact,
             overall_score,
             feedback,
             status,
             created_at,
             updated_at`,
          [
            Number(problem_relevance),
            Number(innovation),
            Number(technical_depth),
            Number(impact),
            finalScore.toFixed(2),
            feedback.trim(),
            existingEvaluation.rows[0]
              .id,
          ]
        );

      evaluation =
        updateResult.rows[0];
    } else {
      const insertResult =
        await pool.query(
          `INSERT INTO evaluations (
             submission_id,
             evaluator_id,
             problem_relevance,
             innovation,
             technical_depth,
             impact,
             overall_score,
             feedback,
             status
           )
           VALUES (
             $1,
             $2,
             $3,
             $4,
             $5,
             $6,
             $7,
             $8,
             'COMPLETED'
           )

           RETURNING
             id,
             submission_id,
             evaluator_id,
             problem_relevance,
             innovation,
             technical_depth,
             impact,
             overall_score,
             feedback,
             status,
             created_at,
             updated_at`,
          [
            submissionId,
            req.user.id,
            Number(problem_relevance),
            Number(innovation),
            Number(technical_depth),
            Number(impact),
            finalScore.toFixed(2),
            feedback.trim(),
          ]
        );

      evaluation =
        insertResult.rows[0];
    }

    /* -----------------------------------------------------
       UPDATE ROUND 2 SUBMISSION
    ----------------------------------------------------- */

    const round2SubmissionResult =
      await pool.query(
        `SELECT
           id
         FROM round2_submissions

         WHERE hackathon_id = $1
           AND team_id = $2

         ORDER BY created_at DESC
         LIMIT 1`,
        [
          hackathonId,
          teamId,
        ]
      );

    if (
      round2SubmissionResult.rows.length >
      0
    ) {
      await pool.query(
        `UPDATE round2_submissions
         SET
           status = 'REVIEWED',
           updated_at = NOW()
         WHERE id = $1`,
        [
          round2SubmissionResult.rows[0]
            .id,
        ]
      );
    }

    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    return res.status(200).json({
      success: true,

      message:
        "Round 3 final evaluation submitted successfully",

      evaluation: {
        ...evaluation,

        team_id:
          team.team_id,

        team_name:
          team.team_name,

        hackathon_id:
          team.hackathon_id,

        hackathon_title:
          team.hackathon_title,
      },
    });
  } catch (error) {
    console.error(
      "ROUND 3 EVALUATION ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit Round 3 evaluation",
    });
  }
}