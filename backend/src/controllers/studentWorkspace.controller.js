import pool from "../config/db.js";

/* =========================================================
   GET STUDENT HACKATHON WORKSPACE
   Returns the complete student view for one registered
   hackathon
========================================================= */

export async function getStudentHackathonWorkspace(req, res) {
  try {
    const studentId = req.user.id;
    const { hackathonId } = req.params;

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message: "Hackathon ID is required",
      });
    }

    /* -------------------------------------------------------
       1. Verify student registration and get hackathon
    ------------------------------------------------------- */

    const registrationResult = await pool.query(
      `SELECT
         hp.id AS participant_id,
         hp.status AS registration_status,

         h.id AS hackathon_id,
         h.title,
         h.description,
         h.track,
         h.location,
         h.start_date,
         h.end_date,
         h.registration_deadline,
         h.status,
         h.current_round,
         h.organizer_id

       FROM hackathon_participants hp

       JOIN hackathons h
         ON h.id = hp.hackathon_id

       WHERE hp.user_id = $1
         AND hp.hackathon_id = $2`,
      [studentId, hackathonId]
    );

    if (registrationResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message:
          "You are not registered for this hackathon",
      });
    }

    const hackathon = registrationResult.rows[0];

    /* -------------------------------------------------------
       2. Find student's team for this hackathon
    ------------------------------------------------------- */

    const teamResult = await pool.query(
      `SELECT
         t.id,
         t.name,
         t.status

       FROM team_members tm

       JOIN teams t
         ON t.id = tm.team_id

       WHERE tm.user_id = $1
         AND t.hackathon_id = $2

       LIMIT 1`,
      [studentId, hackathonId]
    );

    const team =
      teamResult.rows.length > 0
        ? teamResult.rows[0]
        : null;

    /* -------------------------------------------------------
       3. Get project
    ------------------------------------------------------- */

    let project = null;

    if (team) {
      const projectResult = await pool.query(
        `SELECT
           id,
           title,
           track

         FROM projects

         WHERE team_id = $1

         LIMIT 1`,
        [team.id]
      );

      if (projectResult.rows.length > 0) {
        project = projectResult.rows[0];
      }
    }

    /* -------------------------------------------------------
       4. Get team members
    ------------------------------------------------------- */

    let members = [];

    if (team) {
      const membersResult = await pool.query(
        `SELECT
           u.id,
           u.name,
           u.email,
           u.avatar_url,
           u.bio,
           u.skills,
           tm.joined_at

         FROM team_members tm

         JOIN users u
           ON u.id = tm.user_id

         WHERE tm.team_id = $1

         ORDER BY tm.joined_at ASC NULLS LAST,
                  u.name ASC`,
        [team.id]
      );

      members = membersResult.rows.map(
        (member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          avatar_url: member.avatar_url,
          bio: member.bio,
          skills: member.skills || [],
          joined_at: member.joined_at,
          is_current_student:
            member.id === studentId,
        })
      );
    }

    /* -------------------------------------------------------
       5. Round 1 submission
    ------------------------------------------------------- */

    let round1Submission = null;

    if (project) {
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
        [project.id]
      );

      if (submissionResult.rows.length > 0) {
        round1Submission =
          submissionResult.rows[0];
      }
    }

    /* -------------------------------------------------------
       6. Round 1 decision
    ------------------------------------------------------- */

    let round1Decision = null;

    if (team) {
      const decisionResult = await pool.query(
        `SELECT
           id,
           decision,
           organizer_feedback,
           decided_at

         FROM round1_decisions

         WHERE hackathon_id = $1
           AND team_id = $2

         LIMIT 1`,
        [hackathonId, team.id]
      );

      if (decisionResult.rows.length > 0) {
        round1Decision =
          decisionResult.rows[0];
      }
    }

    /* -------------------------------------------------------
       7. Round 2 submission
    ------------------------------------------------------- */

    let round2Submission = null;

    if (team) {
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
        [hackathonId, team.id]
      );

      if (round2Result.rows.length > 0) {
        round2Submission =
          round2Result.rows[0];
      }
    }

    /* -------------------------------------------------------
       8. Round 2 decision
    ------------------------------------------------------- */

    let round2Decision = null;

    if (team) {
      const decisionResult = await pool.query(
        `SELECT
           id,
           decision,
           organizer_feedback,
           decided_at

         FROM round2_decisions

         WHERE hackathon_id = $1
           AND team_id = $2

         LIMIT 1`,
        [hackathonId, team.id]
      );

      if (decisionResult.rows.length > 0) {
        round2Decision =
          decisionResult.rows[0];
      }
    }

    /* -------------------------------------------------------
       9. Final evaluation
    ------------------------------------------------------- */

    let finalEvaluation = null;

    if (project) {
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

         WHERE s.project_id = $1

         ORDER BY e.created_at DESC

         LIMIT 1`,
        [project.id]
      );

      if (evaluationResult.rows.length > 0) {
        finalEvaluation =
          evaluationResult.rows[0];
      }
    }

    /* -------------------------------------------------------
       10. Result information
       Only expose result after publication
    ------------------------------------------------------- */

    let result = null;

    if (
      hackathon.status === "COMPLETED" &&
      hackathon.current_round === 4 &&
      team &&
      finalEvaluation
    ) {
      let placement = "FINALIST";

      if (team.status === "WINNER") {
        placement = "WINNER";
      }

      result = {
        rank: null,
        placement,
        score: finalEvaluation.overall_score,
        team_status: team.status,
      };

      /* -----------------------------------------------------
         Get actual rank from final results
      ----------------------------------------------------- */

      const rankingResult = await pool.query(
        `SELECT
           t.id AS team_id,
           e.overall_score

         FROM evaluations e

         JOIN submissions s
           ON s.id = e.submission_id

         JOIN projects p
           ON p.id = s.project_id

         JOIN teams t
           ON t.id = p.team_id

         JOIN round2_submissions r2
           ON r2.team_id = t.id
          AND r2.hackathon_id = t.hackathon_id

         WHERE t.hackathon_id = $1
           AND e.status = 'COMPLETED'
           AND r2.status IN (
             'SUBMITTED',
             'UNDER_REVIEW',
             'REVIEWED'
           )

           AND EXISTS (
             SELECT 1
             FROM round2_decisions r2d
             WHERE r2d.hackathon_id = t.hackathon_id
               AND r2d.team_id = t.id
               AND r2d.decision = 'SELECTED'
           )

         ORDER BY
           e.overall_score DESC,
           e.created_at ASC`,
        [hackathonId]
      );

      const uniqueTeamIds = [];

      for (const row of rankingResult.rows) {
        if (!uniqueTeamIds.includes(row.team_id)) {
          uniqueTeamIds.push(row.team_id);
        }
      }

      const rank =
        uniqueTeamIds.indexOf(team.id) + 1;

      result.rank =
        rank > 0 ? rank : null;

      if (result.rank === 2) {
        result.placement = "RUNNER_UP";
      } else if (result.rank === 3) {
        result.placement =
          "SECOND_RUNNER_UP";
      } else if (
        result.rank > 3
      ) {
        result.placement = "FINALIST";
      }
    }

    /* -------------------------------------------------------
       11. Determine current round name
    ------------------------------------------------------- */

    let currentRoundName = "Round 1";

    if (hackathon.current_round === 2) {
      currentRoundName = "Round 2";
    } else if (hackathon.current_round === 3) {
      currentRoundName = "Round 3";
    } else if (hackathon.current_round === 4) {
      currentRoundName = "Completed";
    }

    /* -------------------------------------------------------
       12. Return complete workspace
    ------------------------------------------------------- */

    return res.status(200).json({
      success: true,

      message:
        "Student hackathon workspace fetched successfully",

      workspace: {
        registration: {
          participant_id:
            hackathon.participant_id,
          status:
            hackathon.registration_status,
        },

        hackathon: {
          id: hackathon.hackathon_id,
          title: hackathon.title,
          description: hackathon.description,
          track: hackathon.track,
          location: hackathon.location,
          start_date: hackathon.start_date,
          end_date: hackathon.end_date,
          registration_deadline:
            hackathon.registration_deadline,
          status: hackathon.status,
          current_round:
            hackathon.current_round,
          current_round_name:
            currentRoundName,
        },

        team: team
          ? {
              id: team.id,
              name: team.name,
              status: team.status,
              total_members:
                members.length,
              members,
            }
          : null,

        project: project
          ? {
              id: project.id,
              title: project.title,
              track: project.track,
            }
          : null,

        rounds: {
          round1: {
            submission:
              round1Submission,
            decision:
              round1Decision,
          },

          round2: {
            submission:
              round2Submission,
            decision:
              round2Decision,
          },

          round3: {
            evaluation:
              finalEvaluation,
          },
        },

        result,
      },
    });
  } catch (error) {
    console.error(
      "GET STUDENT WORKSPACE ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch student hackathon workspace",
    });
  }
}