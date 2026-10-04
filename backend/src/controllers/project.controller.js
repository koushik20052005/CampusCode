import pool from "../config/db.js";

/* =========================================================
   CREATE PROJECT
========================================================= */

export async function createProject(req, res) {
  try {
    const { id: teamId } = req.params;

    const {
      title,
      track,
      problem_statement,
      solution,
      technologies,
      github_url,
      live_demo_url,
      completion_percentage,
    } = req.body;

    const userId = req.user.id;

    // Only students can create projects
    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can create projects",
      });
    }

    // Validate title
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project title is required",
      });
    }

    // Validate completion percentage
    const completion =
      completion_percentage === undefined ||
      completion_percentage === null
        ? 0
        : Number(completion_percentage);

    if (
      !Number.isInteger(completion) ||
      completion < 0 ||
      completion > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Completion percentage must be an integer between 0 and 100",
      });
    }

    // Check team
    const teamResult = await pool.query(
      `
      SELECT
        t.id,
        t.hackathon_id,
        t.name,
        t.leader_id,
        t.status
      FROM teams t
      WHERE t.id = $1
      `,
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    const team = teamResult.rows[0];

    // Project can only be created while team is BUILDING
    if (team.status !== "BUILDING") {
      return res.status(400).json({
        success: false,
        message:
          "Project can only be created while the team is BUILDING",
      });
    }

    // Check whether user belongs to team
    const memberResult = await pool.query(
      `
      SELECT id, role
      FROM team_members
      WHERE team_id = $1
        AND user_id = $2
      `,
      [teamId, userId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message:
          "You must be a member of the team to create a project",
      });
    }

    // Check whether team already has a project
    const existingProjectResult = await pool.query(
      `
      SELECT
        id,
        title
      FROM projects
      WHERE team_id = $1
      `,
      [teamId]
    );

    if (existingProjectResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This team already has a project",
        project: existingProjectResult.rows[0],
      });
    }

    // Prepare technologies
    const projectTechnologies = Array.isArray(technologies)
      ? technologies
      : [];

    // Create project
    const projectResult = await pool.query(
      `
      INSERT INTO projects (
        team_id,
        title,
        track,
        problem_statement,
        solution,
        technologies,
        github_url,
        live_demo_url,
        completion_percentage
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      RETURNING
        id,
        team_id,
        title,
        track,
        problem_statement,
        solution,
        technologies,
        github_url,
        live_demo_url,
        completion_percentage,
        created_at,
        updated_at
      `,
      [
        teamId,
        title.trim(),
        track || null,
        problem_statement || null,
        solution || null,
        projectTechnologies,
        github_url || null,
        live_demo_url || null,
        completion,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      project: projectResult.rows[0],
    });
  } catch (error) {
    // Unique team_id constraint
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This team already has a project",
      });
    }

    console.error("CREATE PROJECT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create project",
    });
  }
}

/* =========================================================
   GET SINGLE PROJECT
========================================================= */

export async function getProjectById(req, res) {
  try {
    const { id } = req.params;

    // Get project details
    const projectResult = await pool.query(
      `
      SELECT
        p.id,
        p.team_id,
        p.title,
        p.track,
        p.problem_statement,
        p.solution,
        p.technologies,
        p.github_url,
        p.live_demo_url,
        p.completion_percentage,
        p.created_at,
        p.updated_at,

        t.name AS team_name,
        t.leader_id,
        t.status AS team_status,

        h.id AS hackathon_id,
        h.title AS hackathon_title

      FROM projects p

      JOIN teams t
        ON t.id = p.team_id

      JOIN hackathons h
        ON h.id = t.hackathon_id

      WHERE p.id = $1
      `,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const project = projectResult.rows[0];

    // Get team members
    const membersResult = await pool.query(
      `
      SELECT
        tm.id,
        tm.user_id,
        u.name,
        u.email,
        u.avatar_url,
        u.bio,
        u.skills,
        tm.role,
        tm.joined_at
      FROM team_members tm
      JOIN users u
        ON u.id = tm.user_id
      WHERE tm.team_id = $1
      ORDER BY tm.joined_at ASC
      `,
      [project.team_id]
    );

    return res.json({
      success: true,
      project: {
        id: project.id,
        team_id: project.team_id,
        title: project.title,
        track: project.track,
        problem_statement: project.problem_statement,
        solution: project.solution,
        technologies: project.technologies,
        github_url: project.github_url,
        live_demo_url: project.live_demo_url,
        completion_percentage:
          project.completion_percentage,
        created_at: project.created_at,
        updated_at: project.updated_at,

        team: {
          id: project.team_id,
          name: project.team_name,
          leader_id: project.leader_id,
          status: project.team_status,

          hackathon: {
            id: project.hackathon_id,
            title: project.hackathon_title,
          },

          members: membersResult.rows,
        },
      },
    });
  } catch (error) {
    console.error("GET PROJECT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch project",
    });
  }
}

/* =========================================================
   GET TEAM PROJECT
========================================================= */

export async function getTeamProject(req, res) {
  try {
    const { teamId } = req.params;

    const projectResult = await pool.query(
      `
      SELECT
        p.id,
        p.team_id,
        p.title,
        p.track,
        p.problem_statement,
        p.solution,
        p.technologies,
        p.github_url,
        p.live_demo_url,
        p.completion_percentage,
        p.created_at,
        p.updated_at
      FROM projects p
      WHERE p.team_id = $1
      `,
      [teamId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No project found for this team",
      });
    }

    return res.json({
      success: true,
      project: projectResult.rows[0],
    });
  } catch (error) {
    console.error("GET TEAM PROJECT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch team project",
    });
  }
}

/* =========================================================
   UPDATE PROJECT
========================================================= */

export async function updateProject(req, res) {
  try {
    const { id } = req.params;

    const {
      title,
      track,
      problem_statement,
      solution,
      technologies,
      github_url,
      live_demo_url,
      completion_percentage,
    } = req.body;

    // Only students can update projects
    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can update projects",
      });
    }

    // Check project + team
    const projectResult = await pool.query(
      `
      SELECT
        p.id,
        p.team_id,
        t.status AS team_status
      FROM projects p
      JOIN teams t
        ON t.id = p.team_id
      WHERE p.id = $1
      `,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const project = projectResult.rows[0];

    // Team must still be BUILDING
    if (project.team_status !== "BUILDING") {
      return res.status(400).json({
        success: false,
        message:
          "Project can only be updated while team is BUILDING",
      });
    }

    // Check team membership
    const memberResult = await pool.query(
      `
      SELECT id
      FROM team_members
      WHERE team_id = $1
        AND user_id = $2
      `,
      [project.team_id, req.user.id]
    );

    if (memberResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this team",
      });
    }

    // Validate title if provided
    if (
      title !== undefined &&
      (!title || !title.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Project title cannot be empty",
      });
    }

    // Validate completion percentage
    if (
      completion_percentage !== undefined &&
      (!Number.isInteger(completion_percentage) ||
        completion_percentage < 0 ||
        completion_percentage > 100)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Completion percentage must be an integer between 0 and 100",
      });
    }

    // Validate technologies
    if (
      technologies !== undefined &&
      !Array.isArray(technologies)
    ) {
      return res.status(400).json({
        success: false,
        message: "Technologies must be an array",
      });
    }

    const updatedResult = await pool.query(
      `
      UPDATE projects
      SET
        title = COALESCE($1, title),
        track = COALESCE($2, track),
        problem_statement = COALESCE($3, problem_statement),
        solution = COALESCE($4, solution),
        technologies = COALESCE($5, technologies),
        github_url = COALESCE($6, github_url),
        live_demo_url = COALESCE($7, live_demo_url),
        completion_percentage = COALESCE($8, completion_percentage),
        updated_at = NOW()
      WHERE id = $9
      RETURNING
        id,
        team_id,
        title,
        track,
        problem_statement,
        solution,
        technologies,
        github_url,
        live_demo_url,
        completion_percentage,
        created_at,
        updated_at
      `,
      [
        title !== undefined ? title.trim() : null,
        track !== undefined ? track : null,
        problem_statement !== undefined
          ? problem_statement
          : null,
        solution !== undefined ? solution : null,
        technologies !== undefined ? technologies : null,
        github_url !== undefined ? github_url : null,
        live_demo_url !== undefined
          ? live_demo_url
          : null,
        completion_percentage !== undefined
          ? completion_percentage
          : null,
        id,
      ]
    );

    return res.json({
      success: true,
      message: "Project updated successfully",
      project: updatedResult.rows[0],
    });
  } catch (error) {
    console.error("UPDATE PROJECT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update project",
    });
  }
}