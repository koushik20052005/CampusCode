import pool from "../config/db.js";

import {
  analyzeProjectWithAI,
} from "../services/ai.service.js";


/* =========================================================
   COMMON ACCESS CHECK
========================================================= */

async function getRound1SubmissionAccess(submissionId, user) {
  const result = await pool.query(
    `
    SELECT
      r1.id,
      r1.hackathon_id,
      r1.team_id,
      r1.submitted_by,
      r1.problem_statement,
      r1.status,
      r1.ai_score,
      r1.ai_feedback,
      r1.ai_recommendation,
      r1.ai_analyzed_at,
      r1.submitted_at,

      h.title AS hackathon_title,
      h.description AS hackathon_description,
      h.organizer_id,

      t.name AS team_name,
      t.status AS team_status,
      t.leader_id

    FROM round1_submissions r1

    INNER JOIN hackathons h
      ON h.id = r1.hackathon_id

    INNER JOIN teams t
      ON t.id = r1.team_id

    WHERE r1.id = $1

    LIMIT 1
    `,
    [submissionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const submission = result.rows[0];

  if (user.role === "ADMIN") {
    return submission;
  }

  if (
    user.role === "ORGANIZER" &&
    String(submission.organizer_id) === String(user.id)
  ) {
    return submission;
  }

  return false;
}


/* =========================================================
   GET ROUND 1 SUBMISSIONS
========================================================= */

export async function getRound1Submissions(req, res) {
  try {
    const { hackathonId } = req.params;

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message: "Hackathon ID is required",
      });
    }

    const hackathonResult = await pool.query(
      `
      SELECT
        h.id,
        h.title,
        h.description,
        h.status,
        h.current_round,
        h.organizer_id,
        h.approval_status,
        h.publication_status,

        u.name AS organizer_name,
        u.email AS organizer_email

      FROM hackathons h

      LEFT JOIN users u
        ON u.id = h.organizer_id

      WHERE h.id = $1
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

    /* -----------------------------------------------------
       ORGANIZER ACCESS
    ----------------------------------------------------- */

    if (
      req.user.role !== "ADMIN" &&
      !(
        req.user.role === "ORGANIZER" &&
        String(hackathon.organizer_id) === String(req.user.id)
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this hackathon",
      });
    }

    /* -----------------------------------------------------
       ROUND 1
    ----------------------------------------------------- */

    const roundResult = await pool.query(
      `
      SELECT
        id,
        hackathon_id,
        round_number,
        title,
        start_at,
        end_at,
        status,
        activated_at,
        activated_by,
        completed_at,
        created_at,
        updated_at

      FROM hackathon_rounds

      WHERE hackathon_id = $1
        AND round_number = 1

      LIMIT 1
      `,
      [hackathonId]
    );

    const round = roundResult.rows[0] || null;

    /* -----------------------------------------------------
       SUBMISSIONS
    ----------------------------------------------------- */

    const submissionsResult = await pool.query(
      `
      SELECT
        r1.id,
        r1.hackathon_id,
        r1.team_id,
        r1.submitted_by,

        r1.problem_statement,
        r1.status,

        r1.ai_score,
        r1.ai_feedback,
        r1.ai_recommendation,
        r1.ai_analyzed_at,

        r1.submitted_at,
        r1.created_at,
        r1.updated_at,

        t.name AS team_name,
        t.status AS team_status,
        t.leader_id,

        leader.name AS leader_name,
        leader.email AS leader_email,

        submitter.name AS submitted_by_name,
        submitter.email AS submitted_by_email,

        d.id AS decision_id,
        d.decision,
        d.organizer_feedback,
        d.decided_by,
        d.decided_at,

        decider.name AS decided_by_name

      FROM round1_submissions r1

      INNER JOIN teams t
        ON t.id = r1.team_id

      LEFT JOIN users leader
        ON leader.id = t.leader_id

      LEFT JOIN users submitter
        ON submitter.id = r1.submitted_by

      LEFT JOIN round1_decisions d
        ON d.hackathon_id = r1.hackathon_id
       AND d.team_id = r1.team_id

      LEFT JOIN users decider
        ON decider.id = d.decided_by

      WHERE r1.hackathon_id = $1

      ORDER BY r1.submitted_at ASC
      `,
      [hackathonId]
    );

    const submissions = [];

    for (const submission of submissionsResult.rows) {
      const membersResult = await pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          tm.role

        FROM team_members tm

        INNER JOIN users u
          ON u.id = tm.user_id

        WHERE tm.team_id = $1

        ORDER BY
          CASE
            WHEN tm.role = 'LEADER' THEN 0
            ELSE 1
          END,
          u.name
        `,
        [submission.team_id]
      );

      submissions.push({
        id: submission.id,

        hackathon_id: submission.hackathon_id,

        team: {
          id: submission.team_id,
          name: submission.team_name,
          status: submission.team_status,
          leader_id: submission.leader_id,
          leader_name: submission.leader_name,
          leader_email: submission.leader_email,
          members: membersResult.rows,
        },

        submitted_by: {
          id: submission.submitted_by,
          name: submission.submitted_by_name,
          email: submission.submitted_by_email,
        },

        problem_statement: submission.problem_statement,

        status: submission.status,

        ai: {
          score:
            submission.ai_score !== null
              ? Number(submission.ai_score)
              : null,

          feedback: submission.ai_feedback,

          recommendation: submission.ai_recommendation,

          analyzed_at: submission.ai_analyzed_at,
        },

        submission: {
          submitted_at: submission.submitted_at,
          created_at: submission.created_at,
          updated_at: submission.updated_at,
        },

        decision: submission.decision
          ? {
              id: submission.decision_id,
              decision: submission.decision,
              feedback: submission.organizer_feedback,
              decided_by: submission.decided_by,
              decided_by_name: submission.decided_by_name,
              decided_at: submission.decided_at,
            }
          : null,
      });
    }

    return res.status(200).json({
      success: true,

      hackathon: {
        id: hackathon.id,
        title: hackathon.title,
        description: hackathon.description,
        status: hackathon.status,
        current_round: hackathon.current_round,
        organizer_id: hackathon.organizer_id,
        organizer_name: hackathon.organizer_name,
        organizer_email: hackathon.organizer_email,
        approval_status: hackathon.approval_status,
        publication_status: hackathon.publication_status,
      },

      round: round
        ? {
            id: round.id,
            round_number: round.round_number,
            title: round.title,
            start_at: round.start_at,
            end_at: round.end_at,
            status: round.status,
            activated_at: round.activated_at,
            activated_by: round.activated_by,
            completed_at: round.completed_at,
          }
        : null,

      submissions,

      total_submissions: submissions.length,

      selected_count: submissions.filter(
        (item) => item.decision?.decision === "SELECTED"
      ).length,

      rejected_count: submissions.filter(
        (item) => item.decision?.decision === "REJECTED"
      ).length,

      pending_count: submissions.filter(
        (item) =>
          !item.decision ||
          !["SELECTED", "REJECTED"].includes(
            item.decision.decision
          )
      ).length,
    });
  } catch (error) {
    console.error(
      "GET ROUND 1 SUBMISSIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch Round 1 submissions",
    });
  }
}


/* =========================================================
   GET SINGLE ROUND 1 SUBMISSION
========================================================= */

export async function getRound1Submission(req, res) {
  try {
    const { submissionId } = req.params;

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: "Submission ID is required",
      });
    }

    const result = await pool.query(
      `
      SELECT
        r1.id,
        r1.hackathon_id,
        r1.team_id,
        r1.submitted_by,

        r1.problem_statement,
        r1.status,

        r1.ai_score,
        r1.ai_feedback,
        r1.ai_recommendation,
        r1.ai_analyzed_at,

        r1.submitted_at,

        h.title AS hackathon_title,
        h.organizer_id,

        t.name AS team_name,
        t.status AS team_status,
        t.leader_id,

        submitter.name AS submitted_by_name,
        submitter.email AS submitted_by_email

      FROM round1_submissions r1

      INNER JOIN hackathons h
        ON h.id = r1.hackathon_id

      INNER JOIN teams t
        ON t.id = r1.team_id

      LEFT JOIN users submitter
        ON submitter.id = r1.submitted_by

      WHERE r1.id = $1

      LIMIT 1
      `,
      [submissionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Round 1 submission not found",
      });
    }

    const submission = result.rows[0];

    if (
      req.user.role !== "ADMIN" &&
      !(
        req.user.role === "ORGANIZER" &&
        String(submission.organizer_id) === String(req.user.id)
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view this submission",
      });
    }

    const membersResult = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        tm.role

      FROM team_members tm

      INNER JOIN users u
        ON u.id = tm.user_id

      WHERE tm.team_id = $1

      ORDER BY
        CASE
          WHEN tm.role = 'LEADER' THEN 0
          ELSE 1
        END,
        u.name
      `,
      [submission.team_id]
    );

    const decisionResult = await pool.query(
      `
      SELECT
        d.id,
        d.decision,
        d.organizer_feedback,
        d.decided_by,
        d.decided_at,

        u.name AS decided_by_name

      FROM round1_decisions d

      LEFT JOIN users u
        ON u.id = d.decided_by

      WHERE d.hackathon_id = $1
        AND d.team_id = $2

      LIMIT 1
      `,
      [
        submission.hackathon_id,
        submission.team_id,
      ]
    );

    return res.status(200).json({
      success: true,

      submission: {
        id: submission.id,

        hackathon: {
          id: submission.hackathon_id,
          title: submission.hackathon_title,
        },

        team: {
          id: submission.team_id,
          name: submission.team_name,
          status: submission.team_status,
          leader_id: submission.leader_id,
          members: membersResult.rows,
        },

        submitted_by: {
          id: submission.submitted_by,
          name: submission.submitted_by_name,
          email: submission.submitted_by_email,
        },

        problem_statement: submission.problem_statement,

        status: submission.status,

        ai: {
          score:
            submission.ai_score !== null
              ? Number(submission.ai_score)
              : null,

          feedback: submission.ai_feedback,

          recommendation: submission.ai_recommendation,

          analyzed_at: submission.ai_analyzed_at,
        },

        submitted_at: submission.submitted_at,

        decision: decisionResult.rows[0] || null,
      },
    });
  } catch (error) {
    console.error(
      "GET SINGLE ROUND 1 SUBMISSION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch Round 1 submission",
    });
  }
}


/* =========================================================
   ANALYZE ROUND 1 SUBMISSION WITH GEMINI AI
========================================================= */

export async function analyzeRound1Submission(req, res) {
  try {
    const { submissionId } = req.params;

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: "Submission ID is required",
      });
    }

    const result = await pool.query(
      `
      SELECT
        r1.id,
        r1.hackathon_id,
        r1.team_id,
        r1.submitted_by,
        r1.problem_statement,
        r1.status,

        h.title AS hackathon_title,
        h.description AS hackathon_description,
        h.organizer_id,

        t.name AS team_name

      FROM round1_submissions r1

      INNER JOIN hackathons h
        ON h.id = r1.hackathon_id

      INNER JOIN teams t
        ON t.id = r1.team_id

      WHERE r1.id = $1

      LIMIT 1
      `,
      [submissionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Round 1 submission not found",
      });
    }

    const submission = result.rows[0];

    /* -----------------------------------------------------
       ACCESS
    ----------------------------------------------------- */

    if (
      req.user.role !== "ADMIN" &&
      !(
        req.user.role === "ORGANIZER" &&
        String(submission.organizer_id) === String(req.user.id)
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to analyze this submission",
      });
    }

    /* -----------------------------------------------------
       STATUS
    ----------------------------------------------------- */

    if (submission.status === "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Draft submissions cannot be analyzed",
      });
    }

    /* -----------------------------------------------------
       AI INPUT
    ----------------------------------------------------- */

    const aiInput = {
      submission_id: submission.id,

      submission_status: submission.status,

      project_id: submission.id,

      title:
        submission.team_name ||
        `Round 1 Submission - ${submission.id}`,

      track: "ROUND_1",

      problem_statement:
        submission.problem_statement,

      /*
       * Round 1 currently contains only the
       * problem statement.
       */
      solution:
        submission.problem_statement,

      technologies:
        "Not specified in Round 1",

      github_url: null,

      live_demo_url: null,

      team_id: submission.team_id,

      team_name: submission.team_name,

      hackathon_id: submission.hackathon_id,

      hackathon_title:
        submission.hackathon_title,

      hackathon_description:
        submission.hackathon_description,
    };

    /* -----------------------------------------------------
       GEMINI
    ----------------------------------------------------- */

    const analysis =
      await analyzeProjectWithAI(aiInput);

    if (!analysis) {
      return res.status(502).json({
        success: false,
        message:
          "Gemini AI returned no analysis",
      });
    }

    /* -----------------------------------------------------
       OVERALL SCORE
    ----------------------------------------------------- */

    let overallScore =
      analysis.overall_score;

    if (
      overallScore === null ||
      overallScore === undefined
    ) {
      const scores = [
        analysis.novelty_score,
        analysis.relevance_score,
        analysis.innovation_score,
        analysis.technical_score,
        analysis.impact_score,
      ]
        .map(Number)
        .filter((value) =>
          Number.isFinite(value)
        );

      if (scores.length > 0) {
        overallScore =
          scores.reduce(
            (sum, value) => sum + value,
            0
          ) / scores.length;
      }
    }

    if (
      overallScore !== null &&
      overallScore !== undefined
    ) {
      overallScore = Number(
        Number(overallScore).toFixed(2)
      );
    }

    /* -----------------------------------------------------
       SAVE AI RESULT
    ----------------------------------------------------- */

    const savedResult = await pool.query(
      `
      UPDATE round1_submissions

      SET
        ai_score = $1,
        ai_feedback = $2,
        ai_recommendation = $3,
        ai_analyzed_at = NOW(),
        updated_at = NOW()

      WHERE id = $4

      RETURNING
        id,
        ai_score,
        ai_feedback,
        ai_recommendation,
        ai_analyzed_at
      `,
      [
        overallScore,

        analysis.feedback || null,

        analysis.recommendation ||
          "REVIEW",

        submission.id,
      ]
    );

    const saved = savedResult.rows[0];

    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    return res.status(200).json({
      success: true,

      message:
        "Gemini AI analysis completed successfully",

      analysis: {
        id: saved.id,

        submission_id: submission.id,

        score:
          saved.ai_score !== null
            ? Number(saved.ai_score)
            : null,

        overall_score: overallScore,

        novelty_score:
          analysis.novelty_score ?? null,

        relevance_score:
          analysis.relevance_score ?? null,

        innovation_score:
          analysis.innovation_score ?? null,

        technical_score:
          analysis.technical_score ?? null,

        impact_score:
          analysis.impact_score ?? null,

        feedback:
          saved.ai_feedback,

        recommendation:
          saved.ai_recommendation,

        model_name:
          analysis.model_name || "Gemini",

        analyzed_at:
          saved.ai_analyzed_at,
      },
    });
  } catch (error) {
    console.error(
      "ROUND 1 GEMINI ANALYSIS ERROR:",
      error
    );

    /* -----------------------------------------------------
       GEMINI KEY ERROR
    ----------------------------------------------------- */

    if (
      error.message?.includes(
        "GEMINI_API_KEY"
      )
    ) {
      return res.status(503).json({
        success: false,
        message:
          "Gemini AI service is not configured",
      });
    }

    /* -----------------------------------------------------
       GEMINI API ERROR
    ----------------------------------------------------- */

    if (
      error.message?.includes(
        "Gemini API request failed"
      ) ||
      error.message?.includes(
        "Gemini API error"
      )
    ) {
      return res.status(502).json({
        success: false,
        message:
          "Gemini AI service request failed",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to analyze Round 1 submission",

      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}


/* =========================================================
   DECIDE ROUND 1
========================================================= */

export async function decideRound1(req, res) {
  try {
    const { submissionId } = req.params;

    const {
      decision,
      organizer_feedback,
    } = req.body;

    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: "Submission ID is required",
      });
    }

    const normalizedDecision =
      String(decision || "")
        .trim()
        .toUpperCase();

    if (
      !["SELECTED", "REJECTED"].includes(
        normalizedDecision
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Decision must be SELECTED or REJECTED",
      });
    }

    /* -----------------------------------------------------
       GET SUBMISSION
    ----------------------------------------------------- */

    const result = await pool.query(
      `
      SELECT
        r1.id,
        r1.hackathon_id,
        r1.team_id,
        r1.submitted_by,
        r1.status AS submission_status,

        h.title AS hackathon_title,
        h.organizer_id,

        t.name AS team_name,
        t.status AS team_status

      FROM round1_submissions r1

      INNER JOIN hackathons h
        ON h.id = r1.hackathon_id

      INNER JOIN teams t
        ON t.id = r1.team_id

      WHERE r1.id = $1

      LIMIT 1
      `,
      [submissionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Round 1 submission not found",
      });
    }

    const submission = result.rows[0];

    /* -----------------------------------------------------
       ACCESS
    ----------------------------------------------------- */

    if (
      req.user.role !== "ADMIN" &&
      !(
        req.user.role === "ORGANIZER" &&
        String(submission.organizer_id) ===
          String(req.user.id)
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to make this decision",
      });
    }

    /* -----------------------------------------------------
       DRAFT
    ----------------------------------------------------- */

    if (
      submission.submission_status ===
      "DRAFT"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Draft submissions cannot be selected or rejected",
      });
    }

    /* -----------------------------------------------------
       ROUND 1
    ----------------------------------------------------- */

    const roundResult = await pool.query(
      `
      SELECT
        id,
        status

      FROM hackathon_rounds

      WHERE hackathon_id = $1
        AND round_number = 1

      LIMIT 1
      `,
      [submission.hackathon_id]
    );

    if (roundResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Round 1 has not been created",
      });
    }

    const round = roundResult.rows[0];

    if (round.status !== "LIVE") {
      return res.status(400).json({
        success: false,
        message:
          "Round 1 must be LIVE before reviewing submissions",
      });
    }

    /* -----------------------------------------------------
       SAVE DECISION
    ----------------------------------------------------- */

    const decisionResult = await pool.query(
      `
      INSERT INTO round1_decisions (
        hackathon_id,
        team_id,
        submission_id,
        round1_submission_id,
        decision,
        decided_by,
        organizer_feedback,
        decided_at
      )

      VALUES (
        $1,
        $2,
        NULL,
        $3,
        $4,
        $5,
        $6,
        NOW()
      )

      ON CONFLICT (
        hackathon_id,
        team_id
      )

      DO UPDATE SET
        submission_id = NULL,

        round1_submission_id =
          EXCLUDED.round1_submission_id,

        decision =
          EXCLUDED.decision,

        decided_by =
          EXCLUDED.decided_by,

        organizer_feedback =
          EXCLUDED.organizer_feedback,

        decided_at =
          NOW()

      RETURNING
        id,
        hackathon_id,
        team_id,
        submission_id,
        round1_submission_id,
        decision,
        decided_by,
        organizer_feedback,
        decided_at
      `,
      [
        submission.hackathon_id,

        submission.team_id,

        submission.id,

        normalizedDecision,

        req.user.id,

        organizer_feedback
          ? String(
              organizer_feedback
            ).trim()
          : null,
      ]
    );

    const savedDecision =
      decisionResult.rows[0];

    /* -----------------------------------------------------
       UPDATE SUBMISSION STATUS
    ----------------------------------------------------- */

    await pool.query(
      `
      UPDATE round1_submissions

      SET
        status = $1,
        updated_at = NOW()

      WHERE id = $2
      `,
      [
        normalizedDecision,
        submission.id,
      ]
    );

    /* -----------------------------------------------------
       UPDATE TEAM STATUS
    ----------------------------------------------------- */

    const teamStatus =
      normalizedDecision === "SELECTED"
        ? "FINALIST"
        : "DISQUALIFIED";

    await pool.query(
      `
      UPDATE teams

      SET
        status = $1,
        updated_at = NOW()

      WHERE id = $2
      `,
      [
        teamStatus,
        submission.team_id,
      ]
    );

    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    return res.status(200).json({
      success: true,

      message:
        normalizedDecision === "SELECTED"
          ? "Team selected for Round 2"
          : "Team rejected from the hackathon",

      decision: {
        ...savedDecision,

        team_name:
          submission.team_name,

        team_status:
          teamStatus,

        hackathon_title:
          submission.hackathon_title,
      },
    });
  } catch (error) {
    console.error(
      "ROUND 1 DECISION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to save Round 1 decision",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
}


/* =========================================================
   GET ROUND 1 DECISION FOR TEAM
========================================================= */

export async function getRound1Decision(req, res) {
  try {
    const {
      hackathonId,
      teamId,
    } = req.params;

    if (!hackathonId || !teamId) {
      return res.status(400).json({
        success: false,
        message:
          "Hackathon ID and Team ID are required",
      });
    }

    /* -----------------------------------------------------
       IMPORTANT SECURITY CHECK
       Verify that the organizer actually owns
       this hackathon.
    ----------------------------------------------------- */

    const hackathonResult =
      await pool.query(
        `
        SELECT
          id,
          organizer_id,
          title

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
        message: "Hackathon not found",
      });
    }

    const hackathon =
      hackathonResult.rows[0];

    if (
      req.user.role !== "ADMIN" &&
      String(hackathon.organizer_id) !==
        String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to view decisions for this hackathon",
      });
    }

    /* -----------------------------------------------------
       GET DECISION
    ----------------------------------------------------- */

    const result = await pool.query(
      `
      SELECT
        d.id,
        d.hackathon_id,
        d.team_id,
        d.submission_id,
        d.round1_submission_id,
        d.decision,
        d.organizer_feedback,
        d.decided_by,
        d.decided_at,

        u.name AS decided_by_name

      FROM round1_decisions d

      LEFT JOIN users u
        ON u.id = d.decided_by

      WHERE d.hackathon_id = $1
        AND d.team_id = $2

      LIMIT 1
      `,
      [
        hackathonId,
        teamId,
      ]
    );

    return res.status(200).json({
      success: true,

      decision:
        result.rows[0] || null,
    });
  } catch (error) {
    console.error(
      "GET ROUND 1 DECISION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch Round 1 decision",
    });
  }
}