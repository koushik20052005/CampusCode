import pool from "../config/db.js";

/* =========================================================
   CREATE TEAM
   POST /api/student/team/hackathons/:hackathonId
========================================================= */

export async function createTeam(req, res) {
  const client = await pool.connect();

  try {
    const studentId = req.user.id;
    const { hackathonId } = req.params;
    const { name } = req.body;

    // -----------------------------------------------------
    // 1. Only students
    // -----------------------------------------------------

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can create teams",
      });
    }

    // -----------------------------------------------------
    // 2. Validate team name
    // -----------------------------------------------------

    if (
      !name ||
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Team name is required",
      });
    }

    const cleanName = name.trim();

    if (cleanName.length < 2) {
      return res.status(400).json({
        success: false,
        message:
          "Team name must contain at least 2 characters",
      });
    }

    if (cleanName.length > 100) {
      return res.status(400).json({
        success: false,
        message:
          "Team name cannot exceed 100 characters",
      });
    }

    // -----------------------------------------------------
    // 3. Get hackathon
    // -----------------------------------------------------

    const hackathonResult = await client.query(
      `
      SELECT
        id,
        title,
        status,
        max_teams,
        publication_status,
        registration_deadline,
        start_date
      FROM hackathons
      WHERE id = $1
      LIMIT 1
      `,
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

    // -----------------------------------------------------
    // 4. Hackathon must be published/open
    // -----------------------------------------------------

    if (
      hackathon.publication_status !==
      "PUBLISHED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Teams can only be created for published hackathons",
      });
    }
if (
  !["OPEN", "LIVE"].includes(hackathon.status)
) {
  return res.status(400).json({
    success: false,
    message:
      "Teams can only be created while the hackathon is active",
  });
}

    // -----------------------------------------------------
    // 5. Registration deadline
    // -----------------------------------------------------

    if (
      hackathon.registration_deadline &&
      new Date() >
        new Date(hackathon.registration_deadline)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "The registration deadline has passed",
      });
    }

    // -----------------------------------------------------
    // 6. Student must be registered
    // -----------------------------------------------------

    const participantResult = await client.query(
      `
      SELECT
        id,
        status
      FROM hackathon_participants
      WHERE hackathon_id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [hackathonId, studentId]
    );

    if (participantResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message:
          "You must register for the hackathon before creating a team",
      });
    }

    // -----------------------------------------------------
    // 7. Check existing team membership
    // -----------------------------------------------------

    const existingTeamResult =
      await client.query(
        `
        SELECT
          t.id,
          t.name,
          t.hackathon_id,
          t.leader_id,
          t.status
        FROM teams t
        INNER JOIN team_members tm
          ON tm.team_id = t.id
        WHERE t.hackathon_id = $1
          AND tm.user_id = $2
        LIMIT 1
        `,
        [hackathonId, studentId]
      );

    if (existingTeamResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          "You are already a member of a team in this hackathon",
        team: existingTeamResult.rows[0],
      });
    }

    // -----------------------------------------------------
    // 8. Check maximum teams
    // -----------------------------------------------------

    const teamCountResult =
      await client.query(
        `
        SELECT COUNT(*)::int AS count
        FROM teams
        WHERE hackathon_id = $1
        `,
        [hackathonId]
      );

    const teamCount =
      teamCountResult.rows[0].count;

    if (
      hackathon.max_teams !== null &&
      teamCount >= hackathon.max_teams
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Maximum number of teams has been reached",
      });
    }

    // -----------------------------------------------------
    // 9. Create team + leader membership
    // -----------------------------------------------------

    await client.query("BEGIN");

    const teamResult = await client.query(
      `
      INSERT INTO teams (
        hackathon_id,
        name,
        leader_id,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        'BUILDING'
      )
      RETURNING
        id,
        hackathon_id,
        name,
        leader_id,
        status,
        created_at,
        updated_at
      `,
      [
        hackathonId,
        cleanName,
        studentId,
      ]
    );

    const team = teamResult.rows[0];

    // Add creator as leader
    await client.query(
      `
      INSERT INTO team_members (
        team_id,
        user_id,
        role
      )
      VALUES (
        $1,
        $2,
        'LEADER'
      )
      `,
      [team.id, studentId]
    );

    await client.query("COMMIT");

    // -----------------------------------------------------
    // 10. Response
    // -----------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Team created successfully",

      team: {
        ...team,
        hackathon: {
          id: hackathon.id,
          title: hackathon.title,
        },
        member_count: 1,
        members: [
          {
            user_id: studentId,
            role: "LEADER",
          },
        ],
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "CREATE STUDENT TEAM ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to create team",
    });
  } finally {
    client.release();
  }
}


/* =========================================================
   GET MY TEAM
   GET /api/student/team
========================================================= */

export async function getMyTeam(req, res) {
  try {
    const studentId = req.user.id;

    const teamResult = await pool.query(
      `
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        t.status AS team_status,
        t.leader_id,
        t.hackathon_id,

        h.title AS hackathon_title,
        h.track AS hackathon_track,
        h.status AS hackathon_status,
        h.current_round,

        p.id AS project_id,
        p.title AS project_title,
        p.track AS project_track

      FROM team_members tm

      INNER JOIN teams t
        ON t.id = tm.team_id

      INNER JOIN hackathons h
        ON h.id = t.hackathon_id

      LEFT JOIN projects p
        ON p.team_id = t.id

      WHERE tm.user_id = $1

      ORDER BY h.start_date DESC NULLS LAST
      LIMIT 1
      `,
      [studentId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "You are not part of any team",
      });
    }

    const team = teamResult.rows[0];

    const membersResult = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role AS user_role,
        u.avatar_url,
        u.bio,
        u.skills,
        tm.role AS team_role,
        tm.joined_at

      FROM team_members tm

      INNER JOIN users u
        ON u.id = tm.user_id

      WHERE tm.team_id = $1

      ORDER BY
        CASE
          WHEN tm.role = 'LEADER' THEN 0
          ELSE 1
        END,
        tm.joined_at ASC NULLS LAST,
        u.name ASC
      `,
      [team.team_id]
    );

    const members =
      membersResult.rows.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        user_role: member.user_role,
        team_role: member.team_role,
        avatar_url: member.avatar_url,
        bio: member.bio,
        skills: member.skills || [],
        joined_at: member.joined_at,
      }));

    return res.status(200).json({
      success: true,
      message: "My team fetched successfully",

      team: {
        id: team.team_id,
        name: team.team_name,
        status: team.team_status,
        leader_id: team.leader_id,

        hackathon: {
          id: team.hackathon_id,
          title: team.hackathon_title,
          track: team.hackathon_track,
          status: team.hackathon_status,
          current_round: team.current_round,
        },

        project: team.project_id
          ? {
              id: team.project_id,
              title: team.project_title,
              track: team.project_track,
            }
          : null,

        total_members: members.length,
        members,
      },
    });
  } catch (error) {
    console.error(
      "GET MY TEAM ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch my team",
    });
  }
}


/* =========================================================
   GET MY TEAMMATES
   GET /api/student/team/teammates
========================================================= */

export async function getMyTeammates(req, res) {
  try {
    const studentId = req.user.id;

    const teamResult = await pool.query(
      `
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        t.status AS team_status,
        t.hackathon_id,
        h.title AS hackathon_title

      FROM team_members tm

      INNER JOIN teams t
        ON t.id = tm.team_id

      INNER JOIN hackathons h
        ON h.id = t.hackathon_id

      WHERE tm.user_id = $1

      ORDER BY h.start_date DESC NULLS LAST
      LIMIT 1
      `,
      [studentId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "You are not part of any team",
      });
    }

    const team = teamResult.rows[0];

    const teammatesResult =
      await pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          u.role AS user_role,
          u.avatar_url,
          u.bio,
          u.skills,
          tm.role AS team_role,
          tm.joined_at

        FROM team_members tm

        INNER JOIN users u
          ON u.id = tm.user_id

        WHERE tm.team_id = $1
          AND tm.user_id <> $2

        ORDER BY
          tm.joined_at ASC NULLS LAST,
          u.name ASC
        `,
        [team.team_id, studentId]
      );

    const teammates =
      teammatesResult.rows.map(
        (member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          user_role: member.user_role,
          team_role: member.team_role,
          avatar_url: member.avatar_url,
          bio: member.bio,
          skills: member.skills || [],
          joined_at: member.joined_at,
        })
      );

    return res.status(200).json({
      success: true,
      message:
        "My teammates fetched successfully",

      team: {
        id: team.team_id,
        name: team.team_name,
        status: team.team_status,
        hackathon_id: team.hackathon_id,
        hackathon_title:
          team.hackathon_title,
      },

      total_teammates:
        teammates.length,

      teammates,
    });
  } catch (error) {
    console.error(
      "GET MY TEAMMATES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch my teammates",
    });
  }
}