import pool from "../config/db.js";

/* =========================================================
   SUBMIT ROUND 2 PROJECT
========================================================= */

export async function submitRound2(req, res) {
  try {
    const { hackathonId } = req.params;

    const {
      github_url,
      pdf_url,
    } = req.body;

    /* -----------------------------------------------------
       VALIDATE HACKATHON ID
    ----------------------------------------------------- */

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message: "Hackathon ID is required",
      });
    }

    /* -----------------------------------------------------
       VALIDATE GITHUB URL
    ----------------------------------------------------- */

    if (
      !github_url ||
      typeof github_url !== "string" ||
      !github_url.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "GitHub repository URL is required",
      });
    }

    /* -----------------------------------------------------
       GET HACKATHON
    ----------------------------------------------------- */

    const hackathonResult = await pool.query(
      `SELECT
         id,
         title,
         status,
         current_round
       FROM hackathons
       WHERE id = $1`,
      [hackathonId]
    );

    if (hackathonResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon =
      hackathonResult.rows[0];

    /* -----------------------------------------------------
       CHECK CURRENT ROUND
    ----------------------------------------------------- */

    if (hackathon.current_round !== 2) {
      return res.status(400).json({
        success: false,
        message:
          `Round 2 submissions are not currently open. Current round is ${hackathon.current_round}`,
      });
    }

    /* -----------------------------------------------------
       FIND USER'S TEAM
    ----------------------------------------------------- */

    const teamResult = await pool.query(
      `SELECT
         t.id AS team_id,
         t.name AS team_name,
         t.status AS team_status
       FROM teams t

       JOIN team_members tm
         ON tm.team_id = t.id

       WHERE t.hackathon_id = $1
         AND tm.user_id = $2`,
      [
        hackathonId,
        req.user.id,
      ]
    );

    if (teamResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message:
          "You are not a member of a team in this hackathon",
      });
    }

    const team =
      teamResult.rows[0];

    /* -----------------------------------------------------
       CHECK ROUND 1 DECISION
    ----------------------------------------------------- */

    const decisionResult = await pool.query(
      `SELECT
         decision
       FROM round1_decisions

       WHERE hackathon_id = $1
         AND team_id = $2

       ORDER BY decided_at DESC
       LIMIT 1`,
      [
        hackathonId,
        team.team_id,
      ]
    );

    if (decisionResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message:
          "Your team has not received a Round 1 decision",
      });
    }

    const round1Decision =
      decisionResult.rows[0].decision;

    if (
      round1Decision !== "SELECTED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your team was not selected for Round 2",
      });
    }

    /* -----------------------------------------------------
       CHECK EXISTING ROUND 2 SUBMISSION
    ----------------------------------------------------- */

    const existingResult = await pool.query(
      `SELECT
         id,
         status,
         github_url,
         pdf_url,
         submitted_at
       FROM round2_submissions

       WHERE hackathon_id = $1
         AND team_id = $2

       LIMIT 1`,
      [
        hackathonId,
        team.team_id,
      ]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Your team has already submitted Round 2",
        submission:
          existingResult.rows[0],
      });
    }

    /* -----------------------------------------------------
       CREATE ROUND 2 SUBMISSION
    ----------------------------------------------------- */

    const submissionResult =
      await pool.query(
        `INSERT INTO round2_submissions (
          hackathon_id,
          team_id,
          submitted_by,
          github_url,
          pdf_url,
          status,
          submitted_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'SUBMITTED',
          NOW()
        )
        RETURNING
          id,
          hackathon_id,
          team_id,
          submitted_by,
          github_url,
          pdf_url,
          status,
          submitted_at,
          created_at`,
        [
          hackathonId,
          team.team_id,
          req.user.id,
          github_url.trim(),
          pdf_url?.trim() || null,
        ]
      );

    const submission =
      submissionResult.rows[0];

    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    return res.status(201).json({
      success: true,

      message:
        "Round 2 project submitted successfully",

      submission: {
        ...submission,

        team_name:
          team.team_name,

        hackathon_title:
          hackathon.title,
      },
    });
  } catch (error) {
    console.error(
      "ROUND 2 SUBMISSION ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit Round 2 project",
    });
  }
}