import pool from "../config/db.js";

import {
  enqueueAnalysisJob,
} from "../services/aiAnalysis.worker.js";
/* =========================================================
   GET ROUND 1 STATUS
   GET /api/student/round1/hackathons/:hackathonId
========================================================= */

export async function getRound1Status(req, res) {
  try {
    const studentId = req.user.id;
    const { hackathonId } = req.params;

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message: "Hackathon ID is required",
      });
    }


    // -----------------------------------------------------
    // 1. CHECK REGISTRATION
    // -----------------------------------------------------

    const registrationResult = await pool.query(
      `
      SELECT
        hp.id AS participant_id,
        hp.status AS registration_status,

        h.id AS hackathon_id,
        h.title AS hackathon_title,
        h.status AS hackathon_status,
        h.current_round,
        h.start_date,
        h.end_date

      FROM hackathon_participants hp

      INNER JOIN hackathons h
        ON h.id = hp.hackathon_id

      WHERE hp.user_id = $1
        AND hp.hackathon_id = $2

      LIMIT 1
      `,
      [studentId, hackathonId]
    );

    if (registrationResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You are not registered for this hackathon",
      });
    }

    const hackathon = registrationResult.rows[0];


    // -----------------------------------------------------
    // 2. GET ROUND 1
    // -----------------------------------------------------

    const roundResult = await pool.query(
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
        AND round_number = 1

      LIMIT 1
      `,
      [hackathonId]
    );

    if (roundResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Round 1 has not been scheduled",
      });
    }

    const round = roundResult.rows[0];


    // -----------------------------------------------------
    // 3. FIND STUDENT'S TEAM
    // -----------------------------------------------------

    const teamResult = await pool.query(
      `
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        t.status AS team_status

      FROM team_members tm

      INNER JOIN teams t
        ON t.id = tm.team_id

      WHERE tm.user_id = $1
        AND t.hackathon_id = $2

      LIMIT 1
      `,
      [studentId, hackathonId]
    );


    // -----------------------------------------------------
    // STUDENT HAS NO TEAM
    // -----------------------------------------------------

    if (teamResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Round 1 status fetched successfully",

        hackathon: {
          id: hackathon.hackathon_id,
          title: hackathon.hackathon_title,
          status: hackathon.hackathon_status,
          current_round: hackathon.current_round,
          start_date: hackathon.start_date,
          end_date: hackathon.end_date,
        },

        round1: {
          ...round,
          accessible: false,
          locked: true,
          reason: "NO_TEAM",
        },

        team: null,

        submission: null,

        decision: null,
      });
    }

    const team = teamResult.rows[0];


    // -----------------------------------------------------
    // 4. GET ROUND 1 SUBMISSION
    //
    // IMPORTANT:
    // Do NOT select ai_score, ai_feedback or ai_analysis
    // because those columns do not exist in round1_submissions.
    // -----------------------------------------------------

    const submissionResult = await pool.query(
      `
      SELECT
        id,
        hackathon_id,
        team_id,
        submitted_by,
        problem_statement,
        status,
        submitted_at,
        created_at,
        updated_at

      FROM round1_submissions

      WHERE hackathon_id = $1
        AND team_id = $2

      LIMIT 1
      `,
      [hackathonId, team.team_id]
    );

    const submission =
      submissionResult.rows.length > 0
        ? submissionResult.rows[0]
        : null;


    // -----------------------------------------------------
    // 5. GET ROUND 1 DECISION
    //
    // THIS IS THE IMPORTANT FIX.
    //
    // Organizer stores the decision in:
    // round1_decisions
    //
    // The StudentPanel expects:
    // data.decision.decision
    // -----------------------------------------------------

    let decision = null;

    if (submission) {
      const decisionResult = await pool.query(
        `
        SELECT
          d.id,
          d.hackathon_id,
          d.team_id,
          d.round1_submission_id,
          d.decision,
          d.organizer_feedback,
          d.decided_by,
          d.decided_at

        FROM round1_decisions d

        WHERE d.hackathon_id = $1
          AND d.team_id = $2

        ORDER BY d.decided_at DESC

        LIMIT 1
        `,
        [hackathonId, team.team_id]
      );

      if (decisionResult.rows.length > 0) {
        const row = decisionResult.rows[0];

        decision = {
          id: row.id,
          hackathon_id: row.hackathon_id,
          team_id: row.team_id,
          round1_submission_id: row.round1_submission_id,
          decision: row.decision,
          organizer_feedback: row.organizer_feedback,
          decided_by: row.decided_by,
          decided_at: row.decided_at,
        };
      }
    }


    // -----------------------------------------------------
    // 6. DETERMINE ACCESSIBILITY
    // -----------------------------------------------------

    const accessible =
      round.status === "LIVE" &&
      Number(hackathon.current_round) === 1;

    let reason = null;

    if (!accessible) {
      if (round.status === "SCHEDULED") {
        reason = "ROUND_NOT_ACTIVE";
      } else if (round.status === "COMPLETED") {
        reason = "ROUND_COMPLETED";
      } else if (
        round.status === "LIVE" &&
        Number(hackathon.current_round) !== 1
      ) {
        reason = "ANOTHER_ROUND_ACTIVE";
      } else {
        reason = "ROUND_NOT_AVAILABLE";
      }
    }


    // -----------------------------------------------------
    // 7. RESPONSE
    // -----------------------------------------------------

    return res.status(200).json({
      success: true,

      message: "Round 1 status fetched successfully",

      hackathon: {
        id: hackathon.hackathon_id,
        title: hackathon.hackathon_title,
        status: hackathon.hackathon_status,
        current_round: hackathon.current_round,
        start_date: hackathon.start_date,
        end_date: hackathon.end_date,
      },

      round1: {
        ...round,

        accessible,
        locked: !accessible,
        reason,
      },

      team: {
        id: team.team_id,
        name: team.team_name,
        status: team.team_status,
      },

      submission,

      // IMPORTANT:
      // StudentPanel.jsx reads:
      // data?.decision?.decision
      decision,
    });
  } catch (error) {
    console.error(
      "GET ROUND 1 STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch Round 1 status",
    });
  }
}



/* =========================================================
   SUBMIT ROUND 1 IDEA
   POST /api/student/round1/hackathons/:hackathonId/submit

   Body:
   {
     "problem_statement": "Our idea..."
   }
========================================================= */

export async function submitRound1(req, res) {
  try {
    const studentId = req.user.id;
    const { hackathonId } = req.params;
    const { problem_statement } = req.body;


    // -----------------------------------------------------
    // 1. VALIDATE
    // -----------------------------------------------------

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message: "Hackathon ID is required",
      });
    }

    if (
      !problem_statement ||
      typeof problem_statement !== "string" ||
      !problem_statement.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Problem statement is required",
      });
    }

    const cleanProblemStatement =
      problem_statement.trim();

    if (cleanProblemStatement.length < 20) {
      return res.status(400).json({
        success: false,
        message:
          "Problem statement must contain at least 20 characters",
      });
    }


    // -----------------------------------------------------
    // 2. CHECK REGISTRATION + HACKATHON
    // -----------------------------------------------------

    const hackathonResult = await pool.query(
      `
      SELECT
        h.id,
        h.title,
        h.status,
        h.publication_status,
        h.current_round

      FROM hackathons h

      INNER JOIN hackathon_participants hp
        ON hp.hackathon_id = h.id

      WHERE h.id = $1
        AND hp.user_id = $2

      LIMIT 1
      `,
      [hackathonId, studentId]
    );

    if (hackathonResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message:
          "You are not registered for this hackathon",
      });
    }

    const hackathon =
      hackathonResult.rows[0];


    // -----------------------------------------------------
    // 3. CHECK ROUND 1
    // -----------------------------------------------------

    const roundResult = await pool.query(
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
        AND round_number = 1

      LIMIT 1
      `,
      [hackathonId]
    );

    if (roundResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Round 1 has not been scheduled",
      });
    }

    const round = roundResult.rows[0];

    if (
      round.status !== "LIVE" ||
      Number(hackathon.current_round) !== 1
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Round 1 submission is not currently open",

        round_status: round.status,
        current_round: hackathon.current_round,
      });
    }


    // -----------------------------------------------------
    // 4. FIND STUDENT'S TEAM
    // -----------------------------------------------------

    const teamResult = await pool.query(
      `
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        t.status AS team_status

      FROM team_members tm

      INNER JOIN teams t
        ON t.id = tm.team_id

      WHERE tm.user_id = $1
        AND t.hackathon_id = $2

      LIMIT 1
      `,
      [studentId, hackathonId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message:
          "You must join or create a team before submitting Round 1",
      });
    }

    const team = teamResult.rows[0];


    // -----------------------------------------------------
    // 5. CHECK EXISTING SUBMISSION
    // -----------------------------------------------------

    const existingResult = await pool.query(
      `
      SELECT
        id,
        problem_statement,
        status,
        submitted_at,
        created_at,
        updated_at

      FROM round1_submissions

      WHERE hackathon_id = $1
        AND team_id = $2

      LIMIT 1
      `,
      [hackathonId, team.team_id]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Your team has already submitted Round 1",

        submission:
          existingResult.rows[0],
      });
    }


    // -----------------------------------------------------
    // 6. CREATE SUBMISSION
    // -----------------------------------------------------

    const submissionResult = await pool.query(
      `
      INSERT INTO round1_submissions (
        hackathon_id,
        team_id,
        submitted_by,
        problem_statement,
        status,
        submitted_at
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        'SUBMITTED',
        NOW()
      )

      RETURNING
        id,
        hackathon_id,
        team_id,
        submitted_by,
        problem_statement,
        status,
        submitted_at,
        created_at,
        updated_at
      `,
      [
        hackathonId,
        team.team_id,
        studentId,
        cleanProblemStatement,
      ]
    );

    const submission =
      submissionResult.rows[0];


    // -----------------------------------------------------
    // 6b. ENQUEUE AUTOMATIC AI ANALYSIS
    // Fire-and-forget: a queue failure must never break
    // the student's submission.
    // -----------------------------------------------------

    enqueueAnalysisJob({
      hackathonId,
      teamId: team.team_id,
      round: 1,
      submissionId: submission.id,
    }).catch((queueError) => {
      console.error(
        "AI ANALYSIS ENQUEUE FAILED (R1):",
        queueError?.message || queueError
      );
    });


    // -----------------------------------------------------
    // 7. RESPONSE
    // -----------------------------------------------------

    return res.status(201).json({
      success: true,

      message:
        "Round 1 idea submitted successfully",

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
      "SUBMIT ROUND 1 ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit Round 1 idea",
    });
  }
}
