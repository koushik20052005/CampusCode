import pool from "../config/db.js";

/* =========================================================
   ORGANIZER FINAL ROUND 2 DECISION
========================================================= */

export async function decideRound2(req, res) {
  try {
    const { submissionId } = req.params;

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
          "Round 2 submission ID is required",
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
       FIND ROUND 2 SUBMISSION
    ----------------------------------------------------- */

    const result = await pool.query(
      `SELECT
         r2.id AS submission_id,
         r2.hackathon_id,
         r2.team_id,
         r2.status AS submission_status,

         t.name AS team_name,

         h.title AS hackathon_title,
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
      return res.status(404).json({
        success: false,
        message:
          "Round 2 submission not found",
      });
    }

    const submission = result.rows[0];

    /* -----------------------------------------------------
       CHECK ORGANIZER / ADMIN ACCESS
    ----------------------------------------------------- */

    if (
      req.user.role !== "ADMIN" &&
      !(
        req.user.role === "ORGANIZER" &&
        submission.organizer_id === req.user.id
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to make this Round 2 decision",
      });
    }

    /* -----------------------------------------------------
       CHECK CURRENT ROUND
    ----------------------------------------------------- */

    if (submission.current_round !== 2) {
      return res.status(400).json({
        success: false,
        message:
          `Round 2 decisions cannot be made because the hackathon is currently on Round ${submission.current_round}`,
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
          "Draft Round 2 submissions cannot be selected",
      });
    }

    /* -----------------------------------------------------
       SAVE ORGANIZER DECISION
    ----------------------------------------------------- */

    const decisionResult = await pool.query(
      `INSERT INTO round2_decisions (
         hackathon_id,
         team_id,
         round2_submission_id,
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
         round2_submission_id,
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

    if (decision === "SELECTED") {
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
       UPDATE ROUND 2 SUBMISSION STATUS
    ----------------------------------------------------- */

    await pool.query(
      `UPDATE round2_submissions
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
          ? "Team selected for Round 3"
          : "Team rejected from Round 2",

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
      "ROUND 2 DECISION ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to save Round 2 decision",
    });
  }
}