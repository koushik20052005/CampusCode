import pool from "../config/db.js";

import {
  analyzeProjectWithAI,
} from "../services/ai.service.js";

/* =========================================================
   CHECK ROUND 2 SUBMISSION ACCESS
========================================================= */

async function getRound2SubmissionAccess(
  submissionId,
  user
) {
  const result = await pool.query(
    `SELECT
       r2.id AS submission_id,
       r2.hackathon_id,
       r2.team_id,
       r2.submitted_by,
       r2.github_url,
       r2.pdf_url,
       r2.status AS submission_status,

       t.name AS team_name,

       h.title AS hackathon_title,
       h.status AS hackathon_status,
       h.current_round,
       h.organizer_id

     FROM round2_submissions r2

     JOIN teams t
       ON t.id = r2.team_id

     JOIN hackathons h
       ON h.id = r2.hackathon_id

     WHERE r2.id = $1`,
    [submissionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const submission =
    result.rows[0];

  /* -----------------------------------------------------
     ADMIN ACCESS
  ----------------------------------------------------- */

  if (user.role === "ADMIN") {
    return submission;
  }

  /* -----------------------------------------------------
     ORGANIZER ACCESS
  ----------------------------------------------------- */

  if (
    user.role === "ORGANIZER" &&
    submission.organizer_id === user.id
  ) {
    return submission;
  }

  return false;
}

/* =========================================================
   RUN AI ANALYSIS FOR ROUND 2 SUBMISSION
========================================================= */

export async function analyzeRound2Submission(
  req,
  res
) {
  try {
    const { submissionId } =
      req.params;

    /* -----------------------------------------------------
       VALIDATE SUBMISSION ID
    ----------------------------------------------------- */

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message:
          "Round 2 submission ID is required",
      });
    }

    /* -----------------------------------------------------
       CHECK ACCESS
    ----------------------------------------------------- */

    const submission =
      await getRound2SubmissionAccess(
        submissionId,
        req.user
      );

    if (submission === null) {
      return res.status(404).json({
        success: false,
        message:
          "Round 2 submission not found",
      });
    }

    if (submission === false) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to analyze this Round 2 submission",
      });
    }

    /* -----------------------------------------------------
       CHECK HACKATHON ROUND
    ----------------------------------------------------- */

    if (
      submission.current_round !== 2
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Round 2 AI analysis is not available because the hackathon is currently on Round ${submission.current_round}`,
      });
    }

    /* -----------------------------------------------------
       CHECK SUBMISSION STATUS
    ----------------------------------------------------- */

    if (
      submission.submission_status ===
      "DRAFT"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Draft Round 2 submissions cannot be analyzed",
      });
    }

    /* -----------------------------------------------------
       BUILD PROJECT DATA FOR GEMINI
    ----------------------------------------------------- */

    const projectResult =
      await pool.query(
        `SELECT
           p.id AS project_id,
           p.title,
           p.track,
           p.problem_statement,
           p.solution,
           p.technologies,
           p.github_url,
           p.live_demo_url

         FROM projects p

         JOIN teams t
           ON t.id = p.team_id

         WHERE t.id = $1`,
        [submission.team_id]
      );

    if (
      projectResult.rows.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Project not found for this team",
      });
    }

    const project =
      projectResult.rows[0];

    /* -----------------------------------------------------
       SEND ROUND 2 DATA TO GEMINI
    ----------------------------------------------------- */

    const aiProject = {
      ...project,

      github_url:
        submission.github_url,

      pdf_url:
        submission.pdf_url,

      round: 2,

      team_name:
        submission.team_name,

      hackathon_title:
        submission.hackathon_title,
    };

    const analysis =
      await analyzeProjectWithAI(
        aiProject
      );

    /* -----------------------------------------------------
       SAVE ROUND 2 AI ANALYSIS
    ----------------------------------------------------- */

    const saveResult =
      await pool.query(
        `INSERT INTO round2_ai_analysis (
          round2_submission_id,
          novelty_score,
          relevance_score,
          innovation_score,
          technical_score,
          impact_score,
          overall_score,
          recommendation,
          feedback,
          model_name
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
          $9,
          $10
        )
        RETURNING
          id,
          round2_submission_id,
          novelty_score,
          relevance_score,
          innovation_score,
          technical_score,
          impact_score,
          overall_score,
          recommendation,
          feedback,
          model_name,
          created_at`,
        [
          submissionId,

          analysis.novelty_score,

          analysis.relevance_score,

          analysis.innovation_score,

          analysis.technical_score,

          analysis.impact_score,

          analysis.overall_score,

          analysis.recommendation,

          analysis.feedback,

          analysis.model_name,
        ]
      );

    const savedAnalysis =
      saveResult.rows[0];

    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    return res.status(201).json({
      success: true,

      message:
        "Round 2 Gemini AI analysis completed successfully",

      analysis: savedAnalysis,

      submission: {
        id:
          submission.submission_id,

        team_id:
          submission.team_id,

        team_name:
          submission.team_name,

        hackathon_id:
          submission.hackathon_id,

        hackathon_title:
          submission.hackathon_title,

        github_url:
          submission.github_url,

        pdf_url:
          submission.pdf_url,
      },
    });
  } catch (error) {
    console.error(
      "ROUND 2 AI ANALYSIS ERROR:",
      error.message
    );

    if (
      error.message.includes(
        "GEMINI_API_KEY"
      )
    ) {
      return res.status(503).json({
        success: false,
        message:
          "Gemini AI service is not configured",
      });
    }

    if (
      error.message.includes(
        "Gemini API request failed"
      )
    ) {
      return res.status(502).json({
        success: false,
        message:
          "Gemini AI service request failed",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to analyze Round 2 submission",
    });
  }
}