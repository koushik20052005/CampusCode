import pool from "../config/db.js";

/* ============================================================
   HELPER — GET ROUND 3
============================================================ */

const getRound3 = async (hackathonId) => {
  const result = await pool.query(
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
      completed_at
    FROM hackathon_rounds
    WHERE hackathon_id = $1
      AND round_number = 3
    LIMIT 1
    `,
    [hackathonId]
  );

  return result.rows[0] || null;
};


/* ============================================================
   HELPER — GET STUDENT TEAM
============================================================ */

const getStudentTeam = async (
  hackathonId,
  userId
) => {
  const result = await pool.query(
    `
    SELECT
      t.id,
      t.name,
      t.leader_id,
      t.status
    FROM teams t
    INNER JOIN team_members tm
      ON tm.team_id = t.id
    WHERE t.hackathon_id = $1
      AND tm.user_id = $2
    LIMIT 1
    `,
    [hackathonId, userId]
  );

  return result.rows[0] || null;
};


/* ============================================================
   GET ROUND 3 STATUS

   GET
   /api/student/round3/hackathons/:hackathonId
============================================================ */

export const getRound3Status = async (
  req,
  res
) => {
  try {
    const { hackathonId } = req.params;

    const userId = req.user.id;

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message: "Hackathon ID is required",
      });
    }

    /* --------------------------------------------------------
       1. GET HACKATHON
    -------------------------------------------------------- */

    const hackathonResult =
      await pool.query(
        `
        SELECT
          id,
          title,
          publication_status,
          current_round,
          status,
          start_date,
          end_date
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

    /* --------------------------------------------------------
       2. CHECK REGISTRATION
    -------------------------------------------------------- */

    const participantResult =
      await pool.query(
        `
        SELECT
          id,
          hackathon_id,
          user_id,
          status
        FROM hackathon_participants
        WHERE hackathon_id = $1
          AND user_id = $2
        LIMIT 1
        `,
        [
          hackathonId,
          userId,
        ]
      );

    if (
      participantResult.rows.length === 0
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not registered for this hackathon",
      });
    }

    const participant =
      participantResult.rows[0];

    /* --------------------------------------------------------
       3. GET STUDENT TEAM
    -------------------------------------------------------- */

    const team =
      await getStudentTeam(
        hackathonId,
        userId
      );

    if (!team) {
      return res.status(200).json({
        success: true,
        message:
          "Round 3 status fetched successfully",

        accessible: false,
        can_submit: false,

        submission: null,
        decision: null,

        score: null,

        hackathon: {
          id: hackathon.id,
          title: hackathon.title,
          publication_status:
            hackathon.publication_status,
          current_round:
            Number(hackathon.current_round),
          status: hackathon.status,
        },

        participant,

        team: null,

        round2: {
          decision: null,
          organizer_feedback: null,
          decided_at: null,
        },

        round3: {
          accessible: false,
          locked: true,
          message:
            "You must join or create a team before accessing Round 3",
          can_submit: false,
          submission: null,
        },

        reason: "NO_TEAM",
      });
    }

    /* --------------------------------------------------------
       4. GET ROUND 3
    -------------------------------------------------------- */

    const round =
      await getRound3(
        hackathonId
      );

    if (!round) {
      return res.status(404).json({
        success: false,
        message:
          "Round 3 has not been configured",
      });
    }

    /* --------------------------------------------------------
       5. GET ROUND 2 DECISION
    -------------------------------------------------------- */

    const round2DecisionResult =
      await pool.query(
        `
        SELECT
          id,
          decision,
          organizer_feedback,
          decided_at
        FROM round2_decisions
        WHERE hackathon_id = $1
          AND team_id = $2
        ORDER BY
          decided_at DESC NULLS LAST,
          id DESC
        LIMIT 1
        `,
        [
          hackathonId,
          team.id,
        ]
      );

    const round2Decision =
      round2DecisionResult.rows[0] ||
      null;

    /* --------------------------------------------------------
       6. GET ROUND 3 SUBMISSION
    -------------------------------------------------------- */

    const submissionResult =
      await pool.query(
        `
        SELECT
          id,
          hackathon_id,
          team_id,
          submitted_by,
          github_url,
          demo_url,
          project_description,
          status,
          decision,
          score,
          organizer_feedback,
          submitted_at,
          reviewed_at,
          reviewed_by,
          created_at,
          updated_at
        FROM round3_submissions
        WHERE hackathon_id = $1
          AND team_id = $2
        ORDER BY
          submitted_at DESC NULLS LAST,
          id DESC
        LIMIT 1
        `,
        [
          hackathonId,
          team.id,
        ]
      );

    const submission =
      submissionResult.rows[0] ||
      null;

    /* --------------------------------------------------------
       7. DETERMINE ROUND 3 ACCESS
    -------------------------------------------------------- */

    let accessible = false;

    let message =
      "Round 3 is locked";

    if (
      round2Decision?.decision !==
      "SELECTED"
    ) {
      message =
        "Your team must be selected from Round 2";
    } else if (
      Number(hackathon.current_round) < 3
    ) {
      message =
        "Round 3 has not been opened by the organizer";
    } else if (
      round.status !== "LIVE"
    ) {
      message =
        `Round 3 is currently ${round.status}`;
    } else {
      const now = new Date();

      if (
        round.start_at &&
        now < new Date(round.start_at)
      ) {
        message =
          "Round 3 has not started yet";
      } else if (
        round.end_at &&
        now > new Date(round.end_at)
      ) {
        message =
          "Round 3 submission period has ended";
      } else {
        accessible = true;

        message =
          "Round 3 is currently open";
      }
    }

    /* --------------------------------------------------------
       8. SUBMISSION PERMISSION
    -------------------------------------------------------- */

    const isLeader =
      String(team.leader_id) ===
      String(userId);

    const canSubmit =
      accessible &&
      isLeader &&
      !submission;

    /* --------------------------------------------------------
       9. SCORE
    -------------------------------------------------------- */

    const score =
      submission?.score !== undefined &&
      submission?.score !== null
        ? Number(submission.score)
        : null;

    /* --------------------------------------------------------
       10. RESPONSE
    -------------------------------------------------------- */

    return res.status(200).json({
      success: true,

      message:
        "Round 3 status fetched successfully",

      /*
       * TOP-LEVEL FIELDS
       * StudentPanel can use these directly.
       */
      accessible,

      can_submit: canSubmit,

      submission,

      decision:
        submission?.decision ||
        null,

      score,

      hackathon: {
        id: hackathon.id,
        title: hackathon.title,
        publication_status:
          hackathon.publication_status,
        current_round:
          Number(hackathon.current_round),
        status: hackathon.status,
        start_date:
          hackathon.start_date,
        end_date:
          hackathon.end_date,
      },

      participant,

      team: {
        id: team.id,
        name: team.name,
        leader_id: team.leader_id,
        status: team.status,
        is_leader: isLeader,
      },

      round: {
        id: round.id,
        round_number:
          round.round_number,
        title: round.title,
        status: round.status,
        start_at: round.start_at,
        end_at: round.end_at,
        activated_at:
          round.activated_at,
        completed_at:
          round.completed_at,
      },

      round2: {
        decision:
          round2Decision?.decision ||
          null,

        organizer_feedback:
          round2Decision?.organizer_feedback ||
          null,

        decided_at:
          round2Decision?.decided_at ||
          null,
      },

      round3: {
        accessible,

        locked: !accessible,

        message,

        can_submit: canSubmit,

        submission,

        score,

        decision:
          submission?.decision ||
          null,

        organizer_feedback:
          submission?.organizer_feedback ||
          null,
      },

      reason: accessible
        ? null
        : message,
    });
  } catch (error) {
    console.error(
      "Get Round 3 status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get Round 3 status",
      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
};


/* ============================================================
   SUBMIT ROUND 3

   POST
   /api/student/round3/hackathons/:hackathonId/submit
============================================================ */

export const submitRound3 = async (
  req,
  res
) => {
  try {
    const { hackathonId } =
      req.params;

    const userId =
      req.user.id;

    const {
      github_url,
      demo_url,
      project_description,
    } = req.body;

    /* --------------------------------------------------------
       1. VALIDATE GITHUB URL
    -------------------------------------------------------- */

    if (
      !github_url ||
      !String(github_url).trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "GitHub repository URL is required",
      });
    }

    const githubUrl =
      String(github_url).trim();

    try {
      const parsedGithub =
        new URL(githubUrl);

      const hostname =
        parsedGithub.hostname
          .toLowerCase();

      if (
        hostname !== "github.com" &&
        !hostname.endsWith(
          ".github.com"
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide a valid GitHub repository URL",
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        message:
          "Invalid GitHub URL",
      });
    }

    /* --------------------------------------------------------
       2. VALIDATE DEMO URL
    -------------------------------------------------------- */

    let demoUrl = null;

    if (
      demo_url &&
      String(demo_url).trim()
    ) {
      demoUrl =
        String(demo_url).trim();

      try {
        const parsedDemo =
          new URL(demoUrl);

        if (
          ![
            "http:",
            "https:",
          ].includes(
            parsedDemo.protocol
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Demo URL must use HTTP or HTTPS",
          });
        }
      } catch {
        return res.status(400).json({
          success: false,
          message:
            "Invalid demo URL",
        });
      }
    }

    /* --------------------------------------------------------
       3. PROJECT DESCRIPTION
    -------------------------------------------------------- */

    let projectDescription = null;

    if (
      project_description !==
        undefined &&
      project_description !==
        null
    ) {
      projectDescription =
        String(
          project_description
        ).trim();

      if (
        projectDescription.length >
        10000
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Project description must be 10000 characters or less",
        });
      }

      if (
        !projectDescription
      ) {
        projectDescription =
          null;
      }
    }

    /* --------------------------------------------------------
       4. GET HACKATHON
    -------------------------------------------------------- */

    const hackathonResult =
      await pool.query(
        `
        SELECT
          id,
          title,
          publication_status,
          current_round,
          status
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
        message:
          "Hackathon not found",
      });
    }

    const hackathon =
      hackathonResult.rows[0];

    /* --------------------------------------------------------
       5. HACKATHON MUST BE PUBLISHED
    -------------------------------------------------------- */

    if (
      hackathon.publication_status !==
      "PUBLISHED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Hackathon is not published",
      });
    }

    /* --------------------------------------------------------
       6. ROUND 3 MUST BE CURRENT
    -------------------------------------------------------- */

    if (
      Number(hackathon.current_round) <
      3
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Round 3 has not been opened by the organizer",
        current_round:
          Number(hackathon.current_round),
      });
    }

    /* --------------------------------------------------------
       7. CHECK REGISTRATION
    -------------------------------------------------------- */

    const participantResult =
      await pool.query(
        `
        SELECT
          id,
          hackathon_id,
          user_id,
          status
        FROM hackathon_participants
        WHERE hackathon_id = $1
          AND user_id = $2
        LIMIT 1
        `,
        [
          hackathonId,
          userId,
        ]
      );

    if (
      participantResult.rows.length === 0
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not registered for this hackathon",
      });
    }

    /* --------------------------------------------------------
       8. GET TEAM
    -------------------------------------------------------- */

    const team =
      await getStudentTeam(
        hackathonId,
        userId
      );

    if (!team) {
      return res.status(403).json({
        success: false,
        message:
          "You must join or create a team first",
      });
    }

    /* --------------------------------------------------------
       9. ONLY TEAM LEADER CAN SUBMIT
    -------------------------------------------------------- */

    if (
      String(team.leader_id) !==
      String(userId)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only the team leader can submit Round 3",
      });
    }

    /* --------------------------------------------------------
       10. ROUND 2 MUST BE SELECTED
    -------------------------------------------------------- */

    const round2DecisionResult =
      await pool.query(
        `
        SELECT
          decision,
          organizer_feedback,
          decided_at
        FROM round2_decisions
        WHERE hackathon_id = $1
          AND team_id = $2
        ORDER BY
          decided_at DESC NULLS LAST,
          id DESC
        LIMIT 1
        `,
        [
          hackathonId,
          team.id,
        ]
      );

    const round2Decision =
      round2DecisionResult.rows[0] ||
      null;

    if (
      !round2Decision ||
      round2Decision.decision !==
        "SELECTED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your team has not been selected for Round 3",
      });
    }

    /* --------------------------------------------------------
       11. GET ROUND 3
    -------------------------------------------------------- */

    const round =
      await getRound3(
        hackathonId
      );

    if (!round) {
      return res.status(404).json({
        success: false,
        message:
          "Round 3 has not been configured",
      });
    }

    /* --------------------------------------------------------
       12. ROUND MUST BE LIVE
    -------------------------------------------------------- */

    if (
      round.status !== "LIVE"
    ) {
      return res.status(403).json({
        success: false,
        message:
          `Round 3 is currently ${round.status}`,
      });
    }

    /* --------------------------------------------------------
       13. START / END TIME
    -------------------------------------------------------- */

    const now =
      new Date();

    if (
      round.start_at &&
      now < new Date(
        round.start_at
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Round 3 has not started yet",
        start_at:
          round.start_at,
      });
    }

    if (
      round.end_at &&
      now > new Date(
        round.end_at
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Round 3 submission period has ended",
        end_at:
          round.end_at,
      });
    }

    /* --------------------------------------------------------
       14. CHECK EXISTING SUBMISSION
    -------------------------------------------------------- */

    const existingResult =
      await pool.query(
        `
        SELECT
          id,
          status,
          decision,
          submitted_at
        FROM round3_submissions
        WHERE hackathon_id = $1
          AND team_id = $2
        LIMIT 1
        `,
        [
          hackathonId,
          team.id,
        ]
      );

    if (
      existingResult.rows.length > 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Your team has already submitted Round 3",
        submission:
          existingResult.rows[0],
      });
    }

    /* --------------------------------------------------------
       15. INSERT ROUND 3 SUBMISSION
    -------------------------------------------------------- */

    const result =
      await pool.query(
        `
        INSERT INTO round3_submissions (
          hackathon_id,
          team_id,
          submitted_by,
          github_url,
          demo_url,
          project_description,
          status,
          submitted_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          'SUBMITTED',
          NOW(),
          NOW(),
          NOW()
        )
        RETURNING
          id,
          hackathon_id,
          team_id,
          submitted_by,
          github_url,
          demo_url,
          project_description,
          status,
          submitted_at,
          created_at,
          updated_at
        `,
        [
          hackathonId,
          team.id,
          userId,
          githubUrl,
          demoUrl,
          projectDescription,
        ]
      );

    /* --------------------------------------------------------
       16. SUCCESS
    -------------------------------------------------------- */

    return res.status(201).json({
      success: true,

      message:
        "Round 3 submission submitted successfully",

      accessible: true,

      can_submit: false,

      submission:
        result.rows[0],

      decision: null,

      score: null,

      hackathon: {
        id: hackathon.id,
        title: hackathon.title,
        current_round:
          Number(hackathon.current_round),
        status: hackathon.status,
      },

      team: {
        id: team.id,
        name: team.name,
        leader_id: team.leader_id,
        status: team.status,
      },

      round2: {
        decision:
          round2Decision.decision,
        organizer_feedback:
          round2Decision.organizer_feedback ||
          null,
        decided_at:
          round2Decision.decided_at ||
          null,
      },

      round3: {
        accessible: true,
        can_submit: false,
        submission:
          result.rows[0],
        decision: null,
        score: null,
      },
    });
  } catch (error) {
    console.error(
      "Submit Round 3 error:",
      error
    );

    if (
      error.code === "23505"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Your team has already submitted Round 3",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit Round 3",
      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
};