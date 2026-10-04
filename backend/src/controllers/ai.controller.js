import pool from "../config/db.js";

import {
  analyzeProjectWithAI,
} from "../services/ai.service.js";

/* =========================================================
   CHECK WHETHER USER CAN ACCESS SUBMISSION
========================================================= */

async function getSubmissionAccess(
  submissionId,
  user
) {
  const result = await pool.query(
    `SELECT
       s.id AS submission_id,
       s.status AS submission_status,

       p.id AS project_id,
       p.title,
       p.track,
       p.problem_statement,
       p.solution,
       p.technologies,
       p.github_url,
       p.live_demo_url,

       t.id AS team_id,
       t.hackathon_id,

       h.title AS hackathon_title,
       h.organizer_id

     FROM submissions s

     JOIN projects p
       ON p.id = s.project_id

     JOIN teams t
       ON t.id = p.team_id

     JOIN hackathons h
       ON h.id = t.hackathon_id

     WHERE s.id = $1`,
    [submissionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const submission =
    result.rows[0];

  /* =======================================================
     ADMIN
  ======================================================= */

  if (user.role === "ADMIN") {
    return submission;
  }

  /* =======================================================
     ORGANIZER
  ======================================================= */

  if (
    user.role === "ORGANIZER" &&
    submission.organizer_id === user.id
  ) {
    return submission;
  }

  /* =======================================================
     STUDENT / TEAM MEMBER
  ======================================================= */

  if (user.role === "STUDENT") {
    const memberResult =
      await pool.query(
        `SELECT id
         FROM team_members
         WHERE team_id = $1
           AND user_id = $2`,
        [
          submission.team_id,
          user.id,
        ]
      );

    if (
      memberResult.rows.length > 0
    ) {
      return submission;
    }
  }

  return false;
}

/* =========================================================
   CHECK HACKATHON ACCESS
========================================================= */

async function getHackathonAccess(
  hackathonId,
  user
) {
  const result =
    await pool.query(
      `SELECT
         id,
         title,
         status,
         organizer_id
       FROM hackathons
       WHERE id = $1`,
      [hackathonId]
    );

  if (result.rows.length === 0) {
    return null;
  }

  const hackathon =
    result.rows[0];

  if (user.role === "ADMIN") {
    return hackathon;
  }

  if (
    user.role === "ORGANIZER" &&
    hackathon.organizer_id === user.id
  ) {
    return hackathon;
  }

  return false;
}

/* =========================================================
   SAVE AI ANALYSIS
========================================================= */

async function saveAIAnalysis(
  submissionId,
  analysis
) {
  const result =
    await pool.query(
      `INSERT INTO ai_analysis (
        submission_id,
        novelty_score,
        relevance_score,
        innovation_score,
        technical_score,
        impact_score,
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
        $8
      )
      RETURNING
        id,
        submission_id,
        novelty_score,
        relevance_score,
        innovation_score,
        technical_score,
        impact_score,
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
        analysis.feedback,
        analysis.model_name,
      ]
    );

  return result.rows[0];
}

/* =========================================================
   RUN AI ANALYSIS FOR ONE SUBMISSION
========================================================= */

export async function analyzeSubmission(
  req,
  res
) {
  try {
    const { submissionId } =
      req.params;

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message:
          "Submission ID is required",
      });
    }

    const submission =
      await getSubmissionAccess(
        submissionId,
        req.user
      );

    if (submission === null) {
      return res.status(404).json({
        success: false,
        message:
          "Submission not found",
      });
    }

    if (submission === false) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to analyze this submission",
      });
    }

    if (
      submission.submission_status ===
      "DRAFT"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Draft submissions cannot be analyzed",
      });
    }

    const analysis =
      await analyzeProjectWithAI(
        submission
      );

    const savedAnalysis =
      await saveAIAnalysis(
        submissionId,
        analysis
      );

    return res.status(201).json({
      success: true,

      message:
        "Gemini AI analysis completed successfully",

      analysis: {
        ...savedAnalysis,

        overall_score:
          analysis.overall_score,

        recommendation:
          analysis.recommendation,
      },
    });
  } catch (error) {
    console.error(
      "AI ANALYSIS ERROR:",
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
        "Failed to analyze submission",
    });
  }
}

/* =========================================================
   ANALYZE ALL ROUND 1 SUBMISSIONS
========================================================= */

export async function analyzeHackathonRound1(
  req,
  res
) {
  try {
    const { hackathonId } =
      req.params;

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message:
          "Hackathon ID is required",
      });
    }

    const hackathon =
      await getHackathonAccess(
        hackathonId,
        req.user
      );

    if (hackathon === null) {
      return res.status(404).json({
        success: false,
        message:
          "Hackathon not found",
      });
    }

    if (hackathon === false) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to analyze this hackathon",
      });
    }

    const submissionsResult =
      await pool.query(
        `SELECT
           s.id AS submission_id,
           s.status AS submission_status,

           p.id AS project_id,
           p.title,
           p.track,
           p.problem_statement,
           p.solution,
           p.technologies,
           p.github_url,
           p.live_demo_url,

           t.id AS team_id,
           t.name AS team_name,
           t.hackathon_id

         FROM submissions s

         JOIN projects p
           ON p.id = s.project_id

         JOIN teams t
           ON t.id = p.team_id

         WHERE t.hackathon_id = $1
           AND s.status IN (
             'SUBMITTED',
             'UNDER_REVIEW',
             'REVIEWED'
           )

         ORDER BY s.created_at ASC`,
        [hackathonId]
      );

    const submissions =
      submissionsResult.rows;

    if (submissions.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No eligible Round 1 submissions found",
      });
    }

    const results = [];

    for (
      const submission of submissions
    ) {
      try {
        const analysis =
          await analyzeProjectWithAI(
            submission
          );

        const savedAnalysis =
          await saveAIAnalysis(
            submission.submission_id,
            analysis
          );

        results.push({
          rank: 0,

          submission_id:
            submission.submission_id,

          project_id:
            submission.project_id,

          team_id:
            submission.team_id,

          team_name:
            submission.team_name,

          project_title:
            submission.title,

          novelty_score:
            Number(
              savedAnalysis.novelty_score
            ),

          relevance_score:
            Number(
              savedAnalysis.relevance_score
            ),

          innovation_score:
            Number(
              savedAnalysis.innovation_score
            ),

          technical_score:
            Number(
              savedAnalysis.technical_score
            ),

          impact_score:
            Number(
              savedAnalysis.impact_score
            ),

          overall_score:
            analysis.overall_score,

          recommendation:
            analysis.recommendation,

          feedback:
            savedAnalysis.feedback,

          model_name:
            savedAnalysis.model_name,

          analysis_id:
            savedAnalysis.id,

          created_at:
            savedAnalysis.created_at,
        });
      } catch (error) {
        console.error(
          `AI failed for submission ${submission.submission_id}:`,
          error.message
        );

        results.push({
          rank: 0,

          submission_id:
            submission.submission_id,

          project_id:
            submission.project_id,

          team_id:
            submission.team_id,

          team_name:
            submission.team_name,

          project_title:
            submission.title,

          overall_score:
            null,

          recommendation:
            "REVIEW",

          error:
            error.message,
        });
      }
    }

    /* =====================================================
       RANK SUCCESSFUL ANALYSES
    ===================================================== */

    results.sort(
      (a, b) => {
        if (
          a.overall_score === null
        ) {
          return 1;
        }

        if (
          b.overall_score === null
        ) {
          return -1;
        }

        return (
          b.overall_score -
          a.overall_score
        );
      }
    );

    results.forEach(
      (result, index) => {
        result.rank =
          index + 1;
      }
    );

    return res.status(200).json({
      success: true,

      message:
        "Round 1 AI analysis completed successfully",

      hackathon: {
        id:
          hackathon.id,

        title:
          hackathon.title,

        status:
          hackathon.status,
      },

      total_submissions:
        submissions.length,

      analyzed_submissions:
        results.filter(
          (item) =>
            item.overall_score !==
            null
        ).length,

      failed_submissions:
        results.filter(
          (item) =>
            item.overall_score ===
            null
        ).length,

      results,
    });
  } catch (error) {
    console.error(
      "ROUND 1 AI ANALYSIS ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to analyze Round 1 submissions",
    });
  }
}

/* =========================================================
   GET LATEST AI ANALYSIS
========================================================= */

export async function getSubmissionAIAnalysis(
  req,
  res
) {
  try {
    const { submissionId } =
      req.params;

    const submission =
      await getSubmissionAccess(
        submissionId,
        req.user
      );

    if (submission === null) {
      return res.status(404).json({
        success: false,
        message:
          "Submission not found",
      });
    }

    if (submission === false) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view this AI analysis",
      });
    }

    const result =
      await pool.query(
        `SELECT
           id,
           submission_id,
           novelty_score,
           relevance_score,
           innovation_score,
           technical_score,
           impact_score,
           feedback,
           model_name,
           created_at
         FROM ai_analysis
         WHERE submission_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [submissionId]
      );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No AI analysis found for this submission",
      });
    }

    const analysis =
      result.rows[0];

    const overallScore =
      (
        (
          Number(
            analysis.novelty_score
          ) +
          Number(
            analysis.relevance_score
          ) +
          Number(
            analysis.innovation_score
          ) +
          Number(
            analysis.technical_score
          ) +
          Number(
            analysis.impact_score
          )
        ) / 5
      ).toFixed(2);

    return res.json({
      success: true,

      analysis: {
        ...analysis,

        overall_score:
          Number(overallScore),
      },
    });
  } catch (error) {
    console.error(
      "GET AI ANALYSIS ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch AI analysis",
    });
  }
}
/* =========================================================
   ORGANIZER FINAL ROUND 1 DECISION
========================================================= */

export async function decideRound1(
  req,
  res
) {
  try {
    const { submissionId } =
      req.params;

    const {
      decision,
      organizer_feedback,
    } = req.body;

    /* -----------------------------------------------------
       VALIDATE INPUT
    ----------------------------------------------------- */

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message:
          "Submission ID is required",
      });
    }

    if (
      !["SELECTED", "REJECTED"].includes(
        decision
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Decision must be SELECTED or REJECTED",
      });
    }

    /* -----------------------------------------------------
       FIND SUBMISSION + HACKATHON
    ----------------------------------------------------- */

    const result =
      await pool.query(
        `SELECT
           s.id AS submission_id,

           p.id AS project_id,

           t.id AS team_id,
           t.name AS team_name,
           t.hackathon_id,

           h.title AS hackathon_title,
           h.organizer_id

         FROM submissions s

         JOIN projects p
           ON p.id = s.project_id

         JOIN teams t
           ON t.id = p.team_id

         JOIN hackathons h
           ON h.id = t.hackathon_id

         WHERE s.id = $1`,
        [submissionId]
      );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Submission not found",
      });
    }

    const submission =
      result.rows[0];

    /* -----------------------------------------------------
       ADMIN / ORGANIZER ACCESS
    ----------------------------------------------------- */

    if (
      req.user.role !== "ADMIN" &&
      !(
        req.user.role === "ORGANIZER" &&
        submission.organizer_id ===
          req.user.id
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to make this decision",
      });
    }

    /* -----------------------------------------------------
       CHECK SUBMISSION STATUS
    ----------------------------------------------------- */

    const submissionStatusResult =
      await pool.query(
        `SELECT status
         FROM submissions
         WHERE id = $1`,
        [submissionId]
      );

    const submissionStatus =
      submissionStatusResult.rows[0]
        ?.status;

    if (
      submissionStatus === "DRAFT"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Draft submissions cannot be selected",
      });
    }

    /* -----------------------------------------------------
       SAVE ORGANIZER DECISION
    ----------------------------------------------------- */

    const decisionResult =
      await pool.query(
        `INSERT INTO round1_decisions (
          hackathon_id,
          team_id,
          submission_id,
          decision,
          decided_by,
          organizer_feedback
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
        ON CONFLICT (
          hackathon_id,
          team_id
        )
        DO UPDATE SET
          decision = EXCLUDED.decision,
          decided_by = EXCLUDED.decided_by,
          organizer_feedback =
            EXCLUDED.organizer_feedback,
          decided_at = NOW()

        RETURNING
          id,
          hackathon_id,
          team_id,
          submission_id,
          decision,
          decided_by,
          organizer_feedback,
          decided_at`,
        [
          submission.hackathon_id,
          submission.team_id,
          submission.submission_id,
          decision,
          req.user.id,
          organizer_feedback ||
            null,
        ]
      );

    const savedDecision =
      decisionResult.rows[0];

    /* -----------------------------------------------------
       UPDATE TEAM STATUS
    ----------------------------------------------------- */

    let teamStatus;

    if (
      decision === "SELECTED"
    ) {
      teamStatus = "FINALIST";
    } else {
      teamStatus = "DISQUALIFIED";
    }

    await pool.query(
      `UPDATE teams
       SET
         status = $1,
         updated_at = NOW()
       WHERE id = $2`,
      [
        teamStatus,
        submission.team_id,
      ]
    );

    /* -----------------------------------------------------
       UPDATE SUBMISSION STATUS
    ----------------------------------------------------- */

    await pool.query(
      `UPDATE submissions
       SET
         status = $1,
         updated_at = NOW()
       WHERE id = $2`,
      [
        decision === "SELECTED"
          ? "REVIEWED"
          : "REJECTED",
        submissionId,
      ]
    );

    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    return res.status(200).json({
      success: true,

      message:
        decision === "SELECTED"
          ? "Team selected for Round 2"
          : "Team rejected from the hackathon",

      decision: {
        ...savedDecision,

        team_name:
          submission.team_name,

        hackathon_title:
          submission.hackathon_title,

        team_status:
          teamStatus,
      },
    });
  } catch (error) {
    console.error(
      "ROUND 1 DECISION ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to save Round 1 decision",
    });
  }
}