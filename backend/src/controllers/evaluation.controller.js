import pool from "../config/db.js";

/* =========================================================
   CREATE EVALUATION
========================================================= */

export async function createEvaluation(req, res) {
  try {
    const { submission_id } = req.body;

    const {
      problem_relevance,
      innovation,
      technical_depth,
      impact,
      overall_score,
      feedback,
    } = req.body;

    if (!submission_id) {
      return res.status(400).json({
        success: false,
        message: "submission_id is required",
      });
    }

    const scores = {
      problem_relevance,
      innovation,
      technical_depth,
      impact,
      overall_score,
    };

    for (const [field, value] of Object.entries(scores)) {
      if (
        typeof value !== "number" ||
        Number.isNaN(value) ||
        value < 0 ||
        value > 10
      ) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a number between 0 and 10`,
        });
      }
    }

    const submissionResult = await pool.query(
      `
      SELECT
        s.id,
        s.status AS submission_status,
        p.id AS project_id,
        p.title AS project_title,
        t.id AS team_id,
        t.name AS team_name,
        h.id AS hackathon_id,
        h.title AS hackathon_title,
        h.organizer_id
      FROM submissions s
      JOIN projects p
        ON p.id = s.project_id
      JOIN teams t
        ON t.id = p.team_id
      JOIN hackathons h
        ON h.id = t.hackathon_id
      WHERE s.id = $1
      `,
      [submission_id]
    );

    if (submissionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const submission = submissionResult.rows[0];

    if (
      submission.submission_status !== "UNDER_REVIEW" &&
      submission.submission_status !== "REVIEWED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only submissions under review or already reviewed can be evaluated",
      });
    }

    if (
      req.user.role === "ORGANIZER" &&
      submission.organizer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only evaluate submissions from your own hackathons",
      });
    }

    const existingEvaluation = await pool.query(
      `
      SELECT id
      FROM evaluations
      WHERE submission_id = $1
        AND evaluator_id = $2
      `,
      [submission_id, req.user.id]
    );

    if (existingEvaluation.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "You have already evaluated this submission",
        evaluation_id: existingEvaluation.rows[0].id,
      });
    }

    const result = await pool.query(
      `
      INSERT INTO evaluations (
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
        updated_at
      `,
      [
        submission_id,
        req.user.id,
        problem_relevance,
        innovation,
        technical_depth,
        impact,
        overall_score,
        feedback || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Evaluation created successfully",
      evaluation: result.rows[0],
      submission: {
        id: submission.id,
        project_id: submission.project_id,
        project_title: submission.project_title,
        team_id: submission.team_id,
        team_name: submission.team_name,
        hackathon_id: submission.hackathon_id,
        hackathon_title: submission.hackathon_title,
      },
    });
  } catch (error) {
    console.error("CREATE EVALUATION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create evaluation",
    });
  }
}

/* =========================================================
   GET EVALUATION BY ID
========================================================= */

export async function getEvaluationById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        e.id,
        e.submission_id,
        e.evaluator_id,
        e.problem_relevance,
        e.innovation,
        e.technical_depth,
        e.impact,
        e.overall_score,
        e.feedback,
        e.status,
        e.created_at,
        e.updated_at,

        u.name AS evaluator_name,
        u.email AS evaluator_email,

        s.status AS submission_status,

        p.id AS project_id,
        p.title AS project_title,

        t.id AS team_id,
        t.name AS team_name,

        h.id AS hackathon_id,
        h.title AS hackathon_title,
        h.organizer_id

      FROM evaluations e

      JOIN users u
        ON u.id = e.evaluator_id

      JOIN submissions s
        ON s.id = e.submission_id

      JOIN projects p
        ON p.id = s.project_id

      JOIN teams t
        ON t.id = p.team_id

      JOIN hackathons h
        ON h.id = t.hackathon_id

      WHERE e.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Evaluation not found",
      });
    }

    const evaluation = result.rows[0];

    if (
      req.user.role === "ORGANIZER" &&
      evaluation.organizer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only view evaluations from your own hackathons",
      });
    }

    if (req.user.role === "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Students cannot view evaluator records",
      });
    }

    return res.status(200).json({
      success: true,
      evaluation,
    });
  } catch (error) {
    console.error("GET EVALUATION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get evaluation",
    });
  }
}

/* =========================================================
   GET ALL EVALUATIONS FOR SUBMISSION
========================================================= */

export async function getSubmissionEvaluations(req, res) {
  try {
    const { submissionId } = req.params;

    const submissionResult = await pool.query(
      `
      SELECT
        s.id,
        s.status,
        h.organizer_id,
        h.id AS hackathon_id,
        h.title AS hackathon_title,
        p.id AS project_id,
        p.title AS project_title,
        t.id AS team_id,
        t.name AS team_name
      FROM submissions s
      JOIN projects p
        ON p.id = s.project_id
      JOIN teams t
        ON t.id = p.team_id
      JOIN hackathons h
        ON h.id = t.hackathon_id
      WHERE s.id = $1
      `,
      [submissionId]
    );

    if (submissionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const submission = submissionResult.rows[0];

    if (req.user.role === "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Students cannot view evaluator records",
      });
    }

    if (
      req.user.role === "ORGANIZER" &&
      submission.organizer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only view evaluations from your own hackathons",
      });
    }

    const result = await pool.query(
      `
      SELECT
        e.id,
        e.submission_id,
        e.evaluator_id,
        e.problem_relevance,
        e.innovation,
        e.technical_depth,
        e.impact,
        e.overall_score,
        e.feedback,
        e.status,
        e.created_at,
        e.updated_at,

        u.name AS evaluator_name,
        u.email AS evaluator_email

      FROM evaluations e

      JOIN users u
        ON u.id = e.evaluator_id

      WHERE e.submission_id = $1

      ORDER BY e.created_at ASC
      `,
      [submissionId]
    );

    return res.status(200).json({
      success: true,
      submission: {
        id: submission.id,
        status: submission.status,
        project_id: submission.project_id,
        project_title: submission.project_title,
        team_id: submission.team_id,
        team_name: submission.team_name,
        hackathon_id: submission.hackathon_id,
        hackathon_title: submission.hackathon_title,
      },
      count: result.rows.length,
      evaluations: result.rows,
    });
  } catch (error) {
    console.error(
      "GET SUBMISSION EVALUATIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get submission evaluations",
    });
  }
}

/* =========================================================
   UPDATE EVALUATION
========================================================= */

export async function updateEvaluation(req, res) {
  try {
    const { id } = req.params;

    console.log("UPDATE EVALUATION BODY:", req.body);

    const {
      problem_relevance,
      innovation,
      technical_depth,
      impact,
      overall_score,
      feedback,
      status,
    } = req.body;
    /* -----------------------------------------------------
       GET EXISTING EVALUATION
    ----------------------------------------------------- */

    const existingResult = await pool.query(
      `
      SELECT
        e.*,
        h.organizer_id
      FROM evaluations e
      JOIN submissions s
        ON s.id = e.submission_id
      JOIN projects p
        ON p.id = s.project_id
      JOIN teams t
        ON t.id = p.team_id
      JOIN hackathons h
        ON h.id = t.hackathon_id
      WHERE e.id = $1
      `,
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Evaluation not found",
      });
    }

    const existing = existingResult.rows[0];

    /* -----------------------------------------------------
       AUTHORIZATION
    ----------------------------------------------------- */

    if (req.user.role === "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Students cannot update evaluations",
      });
    }

    if (
      req.user.role === "ORGANIZER" &&
      existing.organizer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only update evaluations from your own hackathons",
      });
    }

    /* -----------------------------------------------------
       VALIDATE SCORES
    ----------------------------------------------------- */

    const scoreFields = {
      problem_relevance,
      innovation,
      technical_depth,
      impact,
      overall_score,
    };

    for (const [field, value] of Object.entries(scoreFields)) {
      if (value !== undefined) {
        const numericValue = Number(value);

        if (
          Number.isNaN(numericValue) ||
          numericValue < 0 ||
          numericValue > 10
        ) {
          return res.status(400).json({
            success: false,
            message: `${field} must be a number between 0 and 10`,
          });
        }
      }
    }

    /* -----------------------------------------------------
       VALIDATE STATUS
    ----------------------------------------------------- */

    const allowedStatuses = [
      "PENDING",
      "COMPLETED",
    ];

    if (
      status !== undefined &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid evaluation status. Allowed values: PENDING, COMPLETED",
      });
    }

    /* -----------------------------------------------------
       PREPARE FINAL VALUES
    ----------------------------------------------------- */

    const finalProblemRelevance =
      problem_relevance !== undefined
        ? Number(problem_relevance)
        : existing.problem_relevance;

    const finalInnovation =
      innovation !== undefined
        ? Number(innovation)
        : existing.innovation;

    const finalTechnicalDepth =
      technical_depth !== undefined
        ? Number(technical_depth)
        : existing.technical_depth;

    const finalImpact =
      impact !== undefined
        ? Number(impact)
        : existing.impact;

    const finalOverallScore =
      overall_score !== undefined
        ? Number(overall_score)
        : Number(existing.overall_score);

    const finalFeedback =
      feedback !== undefined
        ? feedback
        : existing.feedback;

    const finalStatus =
      status !== undefined
        ? status
        : existing.status;

    /* -----------------------------------------------------
       UPDATE EVALUATION
    ----------------------------------------------------- */

    const result = await pool.query(
      `
      UPDATE evaluations
      SET
        problem_relevance = $1,
        innovation = $2,
        technical_depth = $3,
        impact = $4,
        overall_score = $5,
        feedback = $6,
        status = $7::varchar,
        updated_at = NOW()
      WHERE id = $8
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
        updated_at
      `,
      [
        finalProblemRelevance,
        finalInnovation,
        finalTechnicalDepth,
        finalImpact,
        finalOverallScore,
        finalFeedback,
        finalStatus,
        id,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Evaluation updated successfully",
      evaluation: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE EVALUATION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update evaluation",
    });
  }
}

/* =========================================================
   DELETE EVALUATION
========================================================= */

export async function deleteEvaluation(req, res) {
  try {
    const { id } = req.params;

    /* -------------------------------------------------------
       GET EXISTING EVALUATION
    ------------------------------------------------------- */

    const existingResult = await pool.query(
      `
      SELECT
        e.id,
        e.submission_id,
        e.evaluator_id,
        h.organizer_id
      FROM evaluations e
      JOIN submissions s
        ON s.id = e.submission_id
      JOIN projects p
        ON p.id = s.project_id
      JOIN teams t
        ON t.id = p.team_id
      JOIN hackathons h
        ON h.id = t.hackathon_id
      WHERE e.id = $1
      `,
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Evaluation not found",
      });
    }

    const evaluation = existingResult.rows[0];

    /* -------------------------------------------------------
       AUTHORIZATION
    ------------------------------------------------------- */

    if (
      req.user.role !== "ADMIN" &&
      (
        req.user.role !== "ORGANIZER" ||
        evaluation.organizer_id !== req.user.id
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this evaluation",
      });
    }

    /* -------------------------------------------------------
       DELETE EVALUATION
    ------------------------------------------------------- */

    const deleteResult = await pool.query(
      `
      DELETE FROM evaluations
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Evaluation not found",
      });
    }

    /* -------------------------------------------------------
       RESPONSE
    ------------------------------------------------------- */

    return res.status(200).json({
      success: true,
      message: "Evaluation deleted successfully",
      evaluation_id: deleteResult.rows[0].id,
    });

  } catch (error) {
    console.error(
      "DELETE EVALUATION ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete evaluation",
    });
  }
}