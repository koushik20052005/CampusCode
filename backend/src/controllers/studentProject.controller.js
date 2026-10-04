import pool from "../config/db.js";

/* =========================================================
   GET MY PROJECT
   Returns the logged-in student's project
========================================================= */

export async function getMyProject(req, res) {
  try {
    const studentId = req.user.id;

    /* -------------------------------------------------------
       1. Find student's team and project
    ------------------------------------------------------- */

    const projectResult = await pool.query(
      `SELECT
         t.id AS team_id,
         t.name AS team_name,
         t.status AS team_status,
         t.hackathon_id,

         h.title AS hackathon_title,
         h.track AS hackathon_track,
         h.status AS hackathon_status,
         h.current_round,

         p.id AS project_id,
         p.title AS project_title,
         p.track AS project_track

       FROM team_members tm

       JOIN teams t
         ON t.id = tm.team_id

       JOIN hackathons h
         ON h.id = t.hackathon_id

       LEFT JOIN projects p
         ON p.team_id = t.id

       WHERE tm.user_id = $1

       ORDER BY h.start_date DESC NULLS LAST
       LIMIT 1`,
      [studentId]
    );

    /* -------------------------------------------------------
       2. Student has no team
    ------------------------------------------------------- */

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "You are not part of any team",
      });
    }

    const project = projectResult.rows[0];

    /* -------------------------------------------------------
       3. Team has no project
    ------------------------------------------------------- */

    if (!project.project_id) {
      return res.status(404).json({
        success: false,
        message:
          "Your team does not have a project yet",
      });
    }

    /* -------------------------------------------------------
       4. Get original Round 1 submission
    ------------------------------------------------------- */

    const submissionResult = await pool.query(
      `SELECT
         id,
         status,
         submitted_at,
         created_at,
         updated_at

       FROM submissions

       WHERE project_id = $1

       ORDER BY created_at DESC
       LIMIT 1`,
      [project.project_id]
    );

    const submission =
      submissionResult.rows.length > 0
        ? submissionResult.rows[0]
        : null;

    /* -------------------------------------------------------
       5. Get Round 2 submission
    ------------------------------------------------------- */

    const round2Result = await pool.query(
      `SELECT
         id,
         github_url,
         pdf_url,
         status,
         submitted_at,
         created_at,
         updated_at

       FROM round2_submissions

       WHERE hackathon_id = $1
         AND team_id = $2

       LIMIT 1`,
      [
        project.hackathon_id,
        project.team_id,
      ]
    );

    const round2Submission =
      round2Result.rows.length > 0
        ? round2Result.rows[0]
        : null;

    /* -------------------------------------------------------
       6. Get Round 1 decision
    ------------------------------------------------------- */

    const round1DecisionResult =
      await pool.query(
        `SELECT
           id,
           decision,
           organizer_feedback,
           decided_at

         FROM round1_decisions

         WHERE hackathon_id = $1
           AND team_id = $2

         LIMIT 1`,
        [
          project.hackathon_id,
          project.team_id,
        ]
      );

    const round1Decision =
      round1DecisionResult.rows.length > 0
        ? round1DecisionResult.rows[0]
        : null;

    /* -------------------------------------------------------
       7. Get Round 2 decision
    ------------------------------------------------------- */

    const round2DecisionResult =
      await pool.query(
        `SELECT
           id,
           decision,
           organizer_feedback,
           decided_at

         FROM round2_decisions

         WHERE hackathon_id = $1
           AND team_id = $2

         LIMIT 1`,
        [
          project.hackathon_id,
          project.team_id,
        ]
      );

    const round2Decision =
      round2DecisionResult.rows.length > 0
        ? round2DecisionResult.rows[0]
        : null;

    /* -------------------------------------------------------
       8. Get final evaluation
    ------------------------------------------------------- */

    const evaluationResult = await pool.query(
      `SELECT
         e.id,
         e.problem_relevance,
         e.innovation,
         e.technical_depth,
         e.impact,
         e.overall_score,
         e.feedback,
         e.status,
         e.created_at,
         e.updated_at

       FROM evaluations e

       JOIN submissions s
         ON s.id = e.submission_id

       JOIN projects p
         ON p.id = s.project_id

       WHERE p.id = $1

       ORDER BY e.created_at DESC
       LIMIT 1`,
      [project.project_id]
    );

    const evaluation =
      evaluationResult.rows.length > 0
        ? evaluationResult.rows[0]
        : null;

    /* -------------------------------------------------------
       9. Return project information
    ------------------------------------------------------- */

    return res.status(200).json({
      success: true,

      message:
        "My project fetched successfully",

      project: {
        id: project.project_id,
        title: project.project_title,
        track: project.project_track,

        team: {
          id: project.team_id,
          name: project.team_name,
          status: project.team_status,
        },

        hackathon: {
          id: project.hackathon_id,
          title: project.hackathon_title,
          track: project.hackathon_track,
          status: project.hackathon_status,
          current_round: project.current_round,
        },

        round1: {
          submission,
          decision: round1Decision,
        },

        round2: {
          submission: round2Submission,
          decision: round2Decision,
        },

        final_evaluation: evaluation,

        result:
          evaluation &&
          project.hackathon_status === "COMPLETED"
            ? {
                score:
                  evaluation.overall_score,
                placement:
                  project.team_status === "WINNER"
                    ? "WINNER"
                    : "FINALIST",
                team_status:
                  project.team_status,
              }
            : null,
      },
    });
  } catch (error) {
    console.error(
      "GET MY PROJECT ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch my project",
    });
  }
}