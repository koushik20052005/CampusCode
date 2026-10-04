import pool from "../config/db.js";

/* =========================================================
   CREATE SUBMISSION
========================================================= */

export async function createSubmission(req, res) {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Only students can submit projects
    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can submit projects",
      });
    }

    // Check project + team + hackathon
    const projectResult = await pool.query(
      `
      SELECT
        p.id,
        p.team_id,
        p.title,
        t.name AS team_name,
        t.leader_id,
        t.status AS team_status,
        h.id AS hackathon_id,
        h.title AS hackathon_title,
        h.status AS hackathon_status
      FROM projects p
      JOIN teams t
        ON t.id = p.team_id
      JOIN hackathons h
        ON h.id = t.hackathon_id
      WHERE p.id = $1
      `,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const project = projectResult.rows[0];

    // Team must be BUILDING
    if (project.team_status !== "BUILDING") {
      return res.status(400).json({
        success: false,
        message:
          "Project can only be submitted while the team is BUILDING",
      });
    }

    // Hackathon must be LIVE
    if (project.hackathon_status !== "LIVE") {
      return res.status(400).json({
        success: false,
        message:
          "Project submission is only allowed when the hackathon is LIVE",
      });
    }

    // Check team membership
    const memberResult = await pool.query(
      `
      SELECT
        id,
        role
      FROM team_members
      WHERE team_id = $1
        AND user_id = $2
      `,
      [project.team_id, userId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message:
          "You must be a member of the team to submit the project",
      });
    }

    // Check existing submission
    const existingSubmissionResult = await pool.query(
      `
      SELECT
        id,
        project_id,
        submitted_by,
        status,
        submitted_at,
        created_at,
        updated_at
      FROM submissions
      WHERE project_id = $1
      `,
      [projectId]
    );

    if (existingSubmissionResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This project has already been submitted",
        submission: existingSubmissionResult.rows[0],
      });
    }

    // Create submission
    const submissionResult = await pool.query(
      `
      INSERT INTO submissions (
        project_id,
        submitted_by,
        status,
        submitted_at
      )
      VALUES (
        $1,
        $2,
        'SUBMITTED',
        NOW()
      )
      RETURNING
        id,
        project_id,
        submitted_by,
        status,
        submitted_at,
        created_at,
        updated_at
      `,
      [projectId, userId]
    );

    return res.status(201).json({
      success: true,
      message: "Project submitted successfully",
      submission: submissionResult.rows[0],
      project: {
        id: project.id,
        title: project.title,
        team_id: project.team_id,
        team_name: project.team_name,
        hackathon_id: project.hackathon_id,
        hackathon_title: project.hackathon_title,
      },
    });
  } catch (error) {
    console.error("CREATE SUBMISSION ERROR:", error);

    // Handle duplicate submission
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This project has already been submitted",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create submission",
    });
  }
}

/* =========================================================
   GET SUBMISSION BY ID
========================================================= */

export async function getSubmissionById(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.project_id,
        s.submitted_by,
        s.status,
        s.submitted_at,
        s.created_at,
        s.updated_at,

        p.title AS project_title,
        p.track AS project_track,
        p.problem_statement,
        p.solution,
        p.technologies,
        p.github_url,
        p.live_demo_url,
        p.completion_percentage,

        t.id AS team_id,
        t.name AS team_name,
        t.leader_id,
        t.status AS team_status,

        h.id AS hackathon_id,
        h.title AS hackathon_title,
        h.status AS hackathon_status,

        u.name AS submitter_name,
        u.email AS submitter_email,
        u.avatar_url AS submitter_avatar
      FROM submissions s

      JOIN projects p
        ON p.id = s.project_id

      JOIN teams t
        ON t.id = p.team_id

      JOIN hackathons h
        ON h.id = t.hackathon_id

      JOIN users u
        ON u.id = s.submitted_by

      WHERE s.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const submission = result.rows[0];

    /*
      Authorization:
      - ADMIN can view any submission
      - ORGANIZER can view submissions for their hackathon
      - STUDENT can view only if they are a member of the team
    */

    if (userRole === "STUDENT") {
      const memberResult = await pool.query(
        `
        SELECT id
        FROM team_members
        WHERE team_id = $1
          AND user_id = $2
        `,
        [submission.team_id, userId]
      );

      if (memberResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to view this submission",
        });
      }
    }

    if (userRole === "ORGANIZER") {
      const organizerResult = await pool.query(
        `
        SELECT id
        FROM hackathons
        WHERE id = $1
          AND organizer_id = $2
        `,
        [submission.hackathon_id, userId]
      );

      if (organizerResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to view this submission",
        });
      }
    }

    return res.status(200).json({
      success: true,
      submission: {
        id: submission.id,
        project_id: submission.project_id,
        submitted_by: submission.submitted_by,
        status: submission.status,
        submitted_at: submission.submitted_at,
        created_at: submission.created_at,
        updated_at: submission.updated_at,

        submitter: {
          id: submission.submitted_by,
          name: submission.submitter_name,
          email: submission.submitter_email,
          avatar_url: submission.submitter_avatar,
        },

        project: {
          id: submission.project_id,
          title: submission.project_title,
          track: submission.project_track,
          problem_statement: submission.problem_statement,
          solution: submission.solution,
          technologies: submission.technologies,
          github_url: submission.github_url,
          live_demo_url: submission.live_demo_url,
          completion_percentage:
            submission.completion_percentage,
        },

        team: {
          id: submission.team_id,
          name: submission.team_name,
          leader_id: submission.leader_id,
          status: submission.team_status,
        },

        hackathon: {
          id: submission.hackathon_id,
          title: submission.hackathon_title,
          status: submission.hackathon_status,
        },
      },
    });
  } catch (error) {
    console.error("GET SUBMISSION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch submission",
    });
  }
}

/* =========================================================
   GET PROJECT SUBMISSION
========================================================= */

export async function getProjectSubmission(req, res) {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check project + team + hackathon
    const projectResult = await pool.query(
      `
      SELECT
        p.id AS project_id,
        p.title AS project_title,
        p.team_id,

        t.name AS team_name,
        t.leader_id,

        h.id AS hackathon_id,
        h.title AS hackathon_title,
        h.organizer_id
      FROM projects p
      JOIN teams t
        ON t.id = p.team_id
      JOIN hackathons h
        ON h.id = t.hackathon_id
      WHERE p.id = $1
      `,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const project = projectResult.rows[0];

    /*
      Authorization:
      ADMIN       → can view
      ORGANIZER   → only their hackathon
      STUDENT     → must be a team member
    */

    if (userRole === "STUDENT") {
      const memberResult = await pool.query(
        `
        SELECT id
        FROM team_members
        WHERE team_id = $1
          AND user_id = $2
        `,
        [project.team_id, userId]
      );

      if (memberResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to view this project submission",
        });
      }
    }

    if (userRole === "ORGANIZER") {
      if (project.organizer_id !== userId) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to view this project submission",
        });
      }
    }

    // Get submission
    const submissionResult = await pool.query(
      `
      SELECT
        s.id,
        s.project_id,
        s.submitted_by,
        s.status,
        s.submitted_at,
        s.created_at,
        s.updated_at,

        u.name AS submitter_name,
        u.email AS submitter_email,
        u.avatar_url AS submitter_avatar

      FROM submissions s

      JOIN users u
        ON u.id = s.submitted_by

      WHERE s.project_id = $1
      `,
      [projectId]
    );

    // Project exists but has not been submitted
    if (submissionResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        submitted: false,
        message: "Project has not been submitted yet",
        project: {
          id: project.project_id,
          title: project.project_title,
          team_id: project.team_id,
          team_name: project.team_name,
          hackathon_id: project.hackathon_id,
          hackathon_title: project.hackathon_title,
        },
        submission: null,
      });
    }

    const submission = submissionResult.rows[0];

    return res.status(200).json({
      success: true,
      submitted: true,
      submission: {
        id: submission.id,
        project_id: submission.project_id,
        submitted_by: submission.submitted_by,
        status: submission.status,
        submitted_at: submission.submitted_at,
        created_at: submission.created_at,
        updated_at: submission.updated_at,

        submitter: {
          id: submission.submitted_by,
          name: submission.submitter_name,
          email: submission.submitter_email,
          avatar_url: submission.submitter_avatar,
        },
      },
      project: {
        id: project.project_id,
        title: project.project_title,
        team_id: project.team_id,
        team_name: project.team_name,
        hackathon_id: project.hackathon_id,
        hackathon_title: project.hackathon_title,
      },
    });
  } catch (error) {
    console.error("GET PROJECT SUBMISSION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch project submission",
    });
  }
}

/* =========================================================
   UPDATE SUBMISSION STATUS
========================================================= */

export async function updateSubmission(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate status
    const allowedStatuses = [
      "DRAFT",
      "SUBMITTED",
      "UNDER_REVIEW",
      "REVIEWED",
      "REJECTED",
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission status",
        allowedStatuses,
      });
    }

    // Get submission + project + team + hackathon
    const submissionResult = await pool.query(
      `
      SELECT
        s.id,
        s.project_id,
        s.submitted_by,
        s.status AS current_status,

        p.title AS project_title,
        p.team_id,

        t.name AS team_name,
        t.leader_id,
        t.status AS team_status,

        h.id AS hackathon_id,
        h.title AS hackathon_title,
        h.organizer_id,
        h.status AS hackathon_status

      FROM submissions s

      JOIN projects p
        ON p.id = s.project_id

      JOIN teams t
        ON t.id = p.team_id

      JOIN hackathons h
        ON h.id = t.hackathon_id

      WHERE s.id = $1
      `,
      [id]
    );

    if (submissionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const submission = submissionResult.rows[0];

    /*
      ROLE AUTHORIZATION

      ADMIN:
      - Can update any submission

      ORGANIZER:
      - Can update submissions belonging to
        their own hackathon

      STUDENT:
      - Cannot change submission status after submission
    */

    if (userRole === "STUDENT") {
      const memberResult = await pool.query(
        `
        SELECT id
        FROM team_members
        WHERE team_id = $1
          AND user_id = $2
        `,
        [submission.team_id, userId]
      );

      if (memberResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to update this submission",
        });
      }

      return res.status(403).json({
        success: false,
        message:
          "Students cannot change submission status after submission",
      });
    }

    // Organizer can only manage their own hackathon
    if (userRole === "ORGANIZER") {
      if (submission.organizer_id !== userId) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to update this submission",
        });
      }
    }

    /*
      STATUS TRANSITIONS

      DRAFT → SUBMITTED
      SUBMITTED → UNDER_REVIEW
      UNDER_REVIEW → REVIEWED
      UNDER_REVIEW → REJECTED
    */

    const currentStatus = submission.current_status;

    const validTransitions = {
      DRAFT: ["SUBMITTED"],
      SUBMITTED: ["UNDER_REVIEW"],
      UNDER_REVIEW: ["REVIEWED", "REJECTED"],
      REVIEWED: [],
      REJECTED: [],
    };

    if (
      currentStatus !== status &&
      !validTransitions[currentStatus].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${currentStatus} to ${status}`,
      });
    }

    // Update submission
    const updateResult = await pool.query(
      `
      UPDATE submissions
      SET
        status = $1::varchar,
        submitted_at =
          CASE
            WHEN $1::varchar = 'SUBMITTED'
              AND submitted_at IS NULL
            THEN NOW()
            ELSE submitted_at
          END,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        project_id,
        submitted_by,
        status,
        submitted_at,
        created_at,
        updated_at
      `,
      [status, id]
    );

    return res.status(200).json({
      success: true,
      message: "Submission updated successfully",
      submission: updateResult.rows[0],
    });
  } catch (error) {
    console.error("UPDATE SUBMISSION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update submission",
    });
  }
}