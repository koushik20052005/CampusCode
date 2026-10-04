// src/controllers/team.controller.js

import pool from "../config/db.js";

/* =========================================================
   GET SINGLE TEAM
   - ADMIN can view any team
   - ORGANIZER can view teams in their hackathon
   - STUDENT can view only their own team
========================================================= */

export async function getTeamById(req, res) {
  try {
    const { id: teamId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const teamResult = await pool.query(
      `
      SELECT
        t.id,
        t.hackathon_id,
        t.name,
        t.leader_id,
        t.status,
        t.created_at,
        t.updated_at,

        h.title AS hackathon_title,
        h.organizer_id,

        organizer.name AS organizer_name,
        organizer.email AS organizer_email,

        leader.name AS leader_name,
        leader.email AS leader_email

      FROM teams t

      INNER JOIN hackathons h
        ON h.id = t.hackathon_id

      LEFT JOIN users organizer
        ON organizer.id = h.organizer_id

      LEFT JOIN users leader
        ON leader.id = t.leader_id

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

    /* -------------------------------------------------------
       ACCESS CONTROL
    ------------------------------------------------------- */

    if (userRole === "ADMIN") {
      // Admin can view any team.
    } else if (
      userRole === "ORGANIZER" &&
      String(team.organizer_id) === String(userId)
    ) {
      // Hackathon organizer can view their teams.
    } else if (userRole === "STUDENT") {
      const membershipResult = await pool.query(
        `
        SELECT id
        FROM team_members
        WHERE team_id = $1
          AND user_id = $2
        `,
        [teamId, userId]
      );

      if (membershipResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to view this team",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this team",
      });
    }

    /* -------------------------------------------------------
       GET MEMBERS
    ------------------------------------------------------- */

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

      INNER JOIN users u
        ON u.id = tm.user_id

      WHERE tm.team_id = $1

      ORDER BY
        CASE
          WHEN tm.user_id = $2 THEN 0
          WHEN tm.role = 'LEADER' THEN 0
          ELSE 1
        END,
        tm.joined_at ASC
      `,
      [teamId, team.leader_id]
    );

    return res.status(200).json({
      success: true,

      team: {
        id: team.id,
        hackathon_id: team.hackathon_id,
        hackathon_title: team.hackathon_title,

        name: team.name,
        status: team.status,

        leader_id: team.leader_id,

        leader: {
          id: team.leader_id,
          name: team.leader_name,
          email: team.leader_email,
        },

        organizer: {
          id: team.organizer_id,
          name: team.organizer_name,
          email: team.organizer_email,
        },

        created_at: team.created_at,
        updated_at: team.updated_at,

        members: membersResult.rows,
        member_count: membersResult.rows.length,
      },
    });
  } catch (error) {
    console.error("GET TEAM ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch team",
    });
  }
}

/* =========================================================
   JOIN TEAM
========================================================= */

export async function joinTeam(req, res) {
  const client = await pool.connect();

  try {
    const { id: teamId } = req.params;
    const userId = req.user.id;

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can join teams",
      });
    }

    await client.query("BEGIN");

    const teamResult = await client.query(
      `
      SELECT
        t.id,
        t.hackathon_id,
        t.name,
        t.leader_id,
        t.status,
        h.title AS hackathon_title
      FROM teams t
      INNER JOIN hackathons h
        ON h.id = t.hackathon_id
      WHERE t.id = $1
      FOR UPDATE
      `,
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    const team = teamResult.rows[0];

    if (team.status !== "BUILDING") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "You can only join a team that is still building",
      });
    }

    /* -------------------------------------------------------
       CHECK HACKATHON PARTICIPATION
    ------------------------------------------------------- */

    const participantResult = await client.query(
      `
      SELECT id, status
      FROM hackathon_participants
      WHERE hackathon_id = $1
        AND user_id = $2
      `,
      [team.hackathon_id, userId]
    );

    if (participantResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message: "You must join the hackathon before joining a team",
      });
    }

    /* -------------------------------------------------------
       CHECK EXISTING TEAM
    ------------------------------------------------------- */

    const existingTeamResult = await client.query(
      `
      SELECT
        t.id,
        t.name
      FROM teams t
      INNER JOIN team_members tm
        ON tm.team_id = t.id
      WHERE t.hackathon_id = $1
        AND tm.user_id = $2
      `,
      [team.hackathon_id, userId]
    );

    if (existingTeamResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "You are already a member of a team in this hackathon",
        team: existingTeamResult.rows[0],
      });
    }

    /* -------------------------------------------------------
       MAX TEAM SIZE
    ------------------------------------------------------- */

    const memberCountResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM team_members
      WHERE team_id = $1
      `,
      [teamId]
    );

    const memberCount = memberCountResult.rows[0].count;

    if (memberCount >= 4) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "This team is already full. Maximum team size is 4.",
      });
    }

    await client.query(
      `
      INSERT INTO team_members (
        team_id,
        user_id,
        role
      )
      VALUES ($1, $2, 'MEMBER')
      `,
      [teamId, userId]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "You joined the team successfully",

      team: {
        id: team.id,
        hackathon_id: team.hackathon_id,
        hackathon_title: team.hackathon_title,
        name: team.name,
        leader_id: team.leader_id,
        status: team.status,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "You are already a member of this team",
      });
    }

    console.error("JOIN TEAM ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to join team",
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   UPDATE TEAM
========================================================= */

export async function updateTeam(req, res) {
  try {
    const { id: teamId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can update teams",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Team name is required",
      });
    }

    const teamResult = await pool.query(
      `
      SELECT
        id,
        hackathon_id,
        name,
        leader_id,
        status
      FROM teams
      WHERE id = $1
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

    if (String(team.leader_id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Only the team leader can update the team",
      });
    }

    if (team.status !== "BUILDING") {
      return res.status(400).json({
        success: false,
        message: "Only teams in BUILDING status can be updated",
      });
    }

    const updatedTeamResult = await pool.query(
      `
      UPDATE teams
      SET
        name = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        hackathon_id,
        name,
        leader_id,
        status,
        created_at,
        updated_at
      `,
      [name.trim(), teamId]
    );

    return res.status(200).json({
      success: true,
      message: "Team updated successfully",
      team: updatedTeamResult.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "A team with this name already exists in this hackathon",
      });
    }

    console.error("UPDATE TEAM ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update team",
    });
  }
}

/* =========================================================
   LEAVE TEAM
========================================================= */

export async function leaveTeam(req, res) {
  const client = await pool.connect();

  try {
    const { id: teamId } = req.params;
    const userId = req.user.id;

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can leave teams",
      });
    }

    const teamResult = await client.query(
      `
      SELECT
        id,
        name,
        leader_id,
        status
      FROM teams
      WHERE id = $1
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

    if (team.status !== "BUILDING") {
      return res.status(400).json({
        success: false,
        message: "You can only leave a team while it is BUILDING",
      });
    }

    const memberResult = await client.query(
      `
      SELECT
        id,
        role
      FROM team_members
      WHERE team_id = $1
        AND user_id = $2
      `,
      [teamId, userId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "You are not a member of this team",
      });
    }

    if (String(team.leader_id) === String(userId)) {
      return res.status(400).json({
        success: false,
        message:
          "Team leader cannot leave the team. Delete the team instead.",
      });
    }

    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM team_members
      WHERE team_id = $1
        AND user_id = $2
      `,
      [teamId, userId]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "You left the team successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("LEAVE TEAM ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to leave team",
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   DELETE TEAM
========================================================= */

export async function deleteTeam(req, res) {
  try {
    const { id: teamId } = req.params;
    const userId = req.user.id;

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can delete teams",
      });
    }

    const teamResult = await pool.query(
      `
      SELECT
        id,
        name,
        leader_id,
        status
      FROM teams
      WHERE id = $1
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

    if (String(team.leader_id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Only the team leader can delete the team",
      });
    }

    if (team.status !== "BUILDING") {
      return res.status(400).json({
        success: false,
        message: "Only teams in BUILDING status can be deleted",
      });
    }

    await pool.query(
      `
      DELETE FROM teams
      WHERE id = $1
      `,
      [teamId]
    );

    return res.status(200).json({
      success: true,
      message: "Team deleted successfully",
    });
  } catch (error) {
    console.error("DELETE TEAM ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete team",
    });
  }
}

/* =========================================================
   ADD MEMBER TO TEAM - HACKMATE
========================================================= */

export async function addMemberToTeam(req, res) {
  const client = await pool.connect();

  try {
    const { teamId, userId } = req.params;
    const leaderId = req.user.id;

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can add team members",
      });
    }

    if (String(leaderId) === String(userId)) {
      return res.status(400).json({
        success: false,
        message: "You are already a member of this team",
      });
    }

    await client.query("BEGIN");

    /* -------------------------------------------------------
       GET TEAM + LOCK
    ------------------------------------------------------- */

    const teamResult = await client.query(
      `
      SELECT
        t.id,
        t.hackathon_id,
        t.name,
        t.leader_id,
        t.status,
        h.title AS hackathon_title
      FROM teams t
      INNER JOIN hackathons h
        ON h.id = t.hackathon_id
      WHERE t.id = $1
      FOR UPDATE
      `,
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    const team = teamResult.rows[0];

    /* -------------------------------------------------------
       ONLY LEADER
    ------------------------------------------------------- */

    if (String(team.leader_id) !== String(leaderId)) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message: "Only the team leader can add members",
      });
    }

    /* -------------------------------------------------------
       TEAM MUST BE BUILDING
    ------------------------------------------------------- */

    if (team.status !== "BUILDING") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "Members can only be added while the team is BUILDING",
      });
    }

    /* -------------------------------------------------------
       TARGET USER
    ------------------------------------------------------- */

    const userResult = await client.query(
      `
      SELECT
        id,
        name,
        email,
        role,
        is_active,
        avatar_url,
        bio,
        skills
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const user = userResult.rows[0];

    if (user.role !== "STUDENT") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Only students can be added to a team",
      });
    }

    if (user.is_active === false) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "This student's account is inactive",
      });
    }

    /* -------------------------------------------------------
       HACKATHON PARTICIPATION
    ------------------------------------------------------- */

    const participantResult = await client.query(
      `
      SELECT
        id,
        status
      FROM hackathon_participants
      WHERE hackathon_id = $1
        AND user_id = $2
      `,
      [team.hackathon_id, userId]
    );

    if (participantResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message:
          "This student is not registered for this hackathon",
      });
    }

    const participant = participantResult.rows[0];

    if (
      participant.status !== "REGISTERED" &&
      participant.status !== "ACTIVE"
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "This student is not currently eligible for team formation",
      });
    }

    /* -------------------------------------------------------
       ALREADY IN TEAM
    ------------------------------------------------------- */

    const existingTeamResult = await client.query(
      `
      SELECT
        t.id,
        t.name
      FROM teams t
      INNER JOIN team_members tm
        ON tm.team_id = t.id
      WHERE t.hackathon_id = $1
        AND tm.user_id = $2
      `,
      [team.hackathon_id, userId]
    );

    if (existingTeamResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message:
          "This student is already a member of a team in this hackathon",
        team: existingTeamResult.rows[0],
      });
    }

    /* -------------------------------------------------------
       MAX TEAM SIZE
    ------------------------------------------------------- */

    const memberCountResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM team_members
      WHERE team_id = $1
      `,
      [teamId]
    );

    const memberCount = memberCountResult.rows[0].count;
    const MAX_TEAM_SIZE = 4;

    if (memberCount >= MAX_TEAM_SIZE) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "This team is already full. Maximum team size is 4.",
      });
    }

    /* -------------------------------------------------------
       ADD MEMBER
    ------------------------------------------------------- */

    const memberResult = await client.query(
      `
      INSERT INTO team_members (
        team_id,
        user_id,
        role
      )
      VALUES ($1, $2, 'MEMBER')
      RETURNING
        id,
        team_id,
        user_id,
        role,
        joined_at
      `,
      [teamId, userId]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,

      message: `${user.name} was added to the team successfully`,

      member: {
        id: memberResult.rows[0].id,
        team_id: memberResult.rows[0].team_id,
        user_id: memberResult.rows[0].user_id,
        role: memberResult.rows[0].role,
        joined_at: memberResult.rows[0].joined_at,

        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        bio: user.bio,
        skills: user.skills || [],
      },

      team: {
        id: team.id,
        hackathon_id: team.hackathon_id,
        hackathon_title: team.hackathon_title,
        name: team.name,
        leader_id: team.leader_id,
        status: team.status,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "This student is already a member of this team",
      });
    }

    console.error("ADD TEAM MEMBER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to add team member",
    });
  } finally {
    client.release();
  }
}