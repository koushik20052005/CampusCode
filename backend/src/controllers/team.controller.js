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
        h.title AS hackathon_title,
        h.event_type AS hackathon_event_type,
        h.max_team_size AS hackathon_max_team_size
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

    // v6.20 — quizzes are solo: no joining teams on quiz events.
    if (team.hackathon_event_type === "quiz") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Teams are not available for quiz events",
      });
    }

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

    // v6.39 — the cap comes from the event, not a hardcoded 4.
    const teamCap = Number(team.hackathon_max_team_size) || 4;
    if (memberCount >= teamCap) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: `This team is already full. Maximum team size is ${teamCap}.`,
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
   TEAM INVITES — invite-by-CC-ID + accept/decline (v6.56)

   Replaces the old silent direct-add (addMemberToTeam): the
   leader invites by CampusCode ID — like Unstop uses email,
   we use the CC-ID — and the invitee must accept before
   they join. Every validation from the old direct-add is
   kept: leader-only, BUILDING, invitee must be an active
   STUDENT registered for the hackathon, invitee not already
   in a team for this hackathon, team cap from the event
   (v6.39). PENDING invites count toward the cap, like seats
   held, so a leader cannot over-invite a full team.
========================================================= */

/* Load the team row (locked) with its hackathon + leader name. */
async function loadInviteTeam(client, teamId) {
  const teamResult = await client.query(
    `
    SELECT
      t.id,
      t.hackathon_id,
      t.name,
      t.leader_id,
      t.status,

      h.title AS hackathon_title,
      h.event_type AS hackathon_event_type,
      h.max_team_size AS hackathon_max_team_size,

      leader.name AS leader_name

    FROM teams t

    INNER JOIN hackathons h
      ON h.id = t.hackathon_id

    LEFT JOIN users leader
      ON leader.id = t.leader_id

    WHERE t.id = $1
    FOR UPDATE OF t
    `,
    [teamId]
  );

  if (teamResult.rows.length === 0) return null;
  return teamResult.rows[0];
}

/* Shared invitee checks (same as the old direct-add):
   active STUDENT, registered for this hackathon, not already
   in a team for this hackathon.
   Returns { user } or { error: { status, message, team? } }. */
async function validateInvitee(client, team, targetUserId) {
  const userResult = await client.query(
    `
    SELECT
      id,
      name,
      email,
      role,
      is_active,
      campus_code_id
    FROM users
    WHERE id = $1
    `,
    [targetUserId]
  );

  if (userResult.rows.length === 0) {
    return {
      error: {
        status: 404,
        message: "Student not found",
      },
    };
  }

  const user = userResult.rows[0];

  if (user.role !== "STUDENT") {
    return {
      error: {
        status: 400,
        message: "Only students can be added to a team",
      },
    };
  }

  if (user.is_active === false) {
    return {
      error: {
        status: 400,
        message: "This student's account is inactive",
      },
    };
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
    [team.hackathon_id, targetUserId]
  );

  if (participantResult.rows.length === 0) {
    return {
      error: {
        status: 403,
        message:
          "This student is not registered for this hackathon",
      },
    };
  }

  const participant = participantResult.rows[0];

  if (
    participant.status !== "REGISTERED" &&
    participant.status !== "ACTIVE"
  ) {
    return {
      error: {
        status: 400,
        message:
          "This student is not currently eligible for team formation",
      },
    };
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
    [team.hackathon_id, targetUserId]
  );

  if (existingTeamResult.rows.length > 0) {
    return {
      error: {
        status: 409,
        message:
          "This student is already a member of a team in this hackathon",
        team: existingTeamResult.rows[0],
      },
    };
  }

  return { user };
}

/* Members + PENDING invites both occupy seats. */
async function countTeamOccupancy(client, teamId) {
  const membersResult = await client.query(
    `
    SELECT COUNT(*)::int AS count
    FROM team_members
    WHERE team_id = $1
    `,
    [teamId]
  );

  const pendingResult = await client.query(
    `
    SELECT COUNT(*)::int AS count
    FROM team_invites
    WHERE team_id = $1
      AND status = 'PENDING'
    `,
    [teamId]
  );

  return {
    members: membersResult.rows[0].count,
    pending: pendingResult.rows[0].count,
  };
}

/* =========================================================
   INVITE MEMBER TO TEAM — leader only.
   POST /teams/:teamId/invite { campus_code_id } (or { user_id }
   for HackMate recommendations, which carry no CC-ID).
========================================================= */

export async function inviteMemberToTeam(req, res) {
  const client = await pool.connect();

  try {
    const { teamId } = req.params;
    const leaderId = req.user.id;
    const { campus_code_id, user_id } = req.body || {};

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can invite team members",
      });
    }

    const rawCampusId =
      typeof campus_code_id === "string"
        ? campus_code_id.trim()
        : "";

    const rawUserId =
      typeof user_id === "string" ? user_id.trim() : "";

    if (!rawCampusId && !rawUserId) {
      return res.status(400).json({
        success: false,
        message: "CampusCode ID is required",
      });
    }

    await client.query("BEGIN");

    /* -------------------------------------------------------
       GET TEAM + LOCK
    ------------------------------------------------------- */

    const team = await loadInviteTeam(client, teamId);

    if (!team) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // v6.20 — quizzes are solo: no adding members on quiz events.
    if (team.hackathon_event_type === "quiz") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Teams are not available for quiz events",
      });
    }

    /* -------------------------------------------------------
       ONLY LEADER
    ------------------------------------------------------- */

    if (String(team.leader_id) !== String(leaderId)) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message: "Only the team leader can invite members",
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
          "Members can only be invited while the team is BUILDING",
      });
    }

    /* -------------------------------------------------------
       RESOLVE INVITEE — CC-ID (case-insensitive) wins,
       else the user id (HackMate recommendations).
    ------------------------------------------------------- */

    let targetUserId = rawUserId || null;

    if (rawCampusId) {
      const resolved = await client.query(
        `
        SELECT id
        FROM users
        WHERE UPPER(TRIM(campus_code_id)) = UPPER($1)
          AND role = 'STUDENT'
        LIMIT 1
        `,
        [rawCampusId]
      );

      if (resolved.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "No student found with this CampusCode ID",
        });
      }

      targetUserId = resolved.rows[0].id;
    }

    if (String(targetUserId) === String(leaderId)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "You are already a member of this team",
      });
    }

    /* -------------------------------------------------------
       INVITEE CHECKS (same as the old direct-add)
    ------------------------------------------------------- */

    const { user, error } = await validateInvitee(
      client,
      team,
      targetUserId
    );

    if (error) {
      await client.query("ROLLBACK");

      return res.status(error.status).json({
        success: false,
        message: error.message,
        ...(error.team ? { team: error.team } : {}),
      });
    }

    /* -------------------------------------------------------
       NO DUPLICATE PENDING INVITE
    ------------------------------------------------------- */

    const duplicateResult = await client.query(
      `
      SELECT id
      FROM team_invites
      WHERE team_id = $1
        AND invited_user_id = $2
        AND status = 'PENDING'
      LIMIT 1
      `,
      [teamId, targetUserId]
    );

    if (duplicateResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "An invite is already pending for this student",
      });
    }

    /* -------------------------------------------------------
       MAX TEAM SIZE — members + pending invites
    ------------------------------------------------------- */

    // v6.39 — the cap comes from the event, not a hardcoded 4.
    const teamCap = Number(team.hackathon_max_team_size) || 4;
    const occupancy = await countTeamOccupancy(client, teamId);

    if (occupancy.members + occupancy.pending >= teamCap) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          `This team is already full. Maximum team size is ${teamCap}.`,
      });
    }

    /* -------------------------------------------------------
       SEND INVITE — one row per team+user; re-inviting
       after a decline/cancel flips the same row to PENDING.
    ------------------------------------------------------- */

    const inviteResult = await client.query(
      `
      INSERT INTO team_invites (
        team_id,
        invited_user_id,
        invited_by,
        status,
        created_at
      )
      VALUES ($1, $2, $3, 'PENDING', NOW())
      ON CONFLICT (team_id, invited_user_id)
      DO UPDATE SET
        invited_by = EXCLUDED.invited_by,
        status = 'PENDING',
        responded_at = NULL,
        created_at = NOW()
      RETURNING
        id,
        team_id,
        invited_user_id,
        invited_by,
        status,
        created_at,
        responded_at
      `,
      [teamId, targetUserId, leaderId]
    );

    /* -------------------------------------------------------
       NOTIFY THE INVITEE (same transaction — a failed
       insert rolls the invite back).
    ------------------------------------------------------- */

    await client.query(
      `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES ($1, $2, $3, 'TEAM_INVITE')
      `,
      [
        targetUserId,
        "Team invite",
        `${team.leader_name || "A team leader"} invited you to join ${team.name} for ${team.hackathon_title}. Open My Team to accept or decline.`,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,

      message: `Invite sent to ${user.name}. They need to accept before joining.`,

      invite: {
        ...inviteResult.rows[0],
        invited_name: user.name,
        invited_email: user.email,
        invited_campus_code_id: user.campus_code_id,
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

    console.error("INVITE TEAM MEMBER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to send team invite",
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   LIST TEAM INVITES — leader only.
   GET /teams/:teamId/invites
========================================================= */

export async function listTeamInvites(req, res) {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can view team invites",
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
        message: "Only the team leader can view invites",
      });
    }

    const invitesResult = await pool.query(
      `
      SELECT
        ti.id,
        ti.team_id,
        ti.invited_user_id,
        ti.invited_by,
        ti.status,
        ti.created_at,
        ti.responded_at,

        u.name AS invited_name,
        u.email AS invited_email,
        u.campus_code_id AS invited_campus_code_id

      FROM team_invites ti

      INNER JOIN users u
        ON u.id = ti.invited_user_id

      WHERE ti.team_id = $1
      ORDER BY ti.created_at DESC
      `,
      [teamId]
    );

    return res.status(200).json({
      success: true,

      invites: invitesResult.rows,

      team: {
        id: team.id,
        hackathon_id: team.hackathon_id,
        name: team.name,
        status: team.status,
      },
    });
  } catch (error) {
    console.error("LIST TEAM INVITES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load team invites",
    });
  }
}

/* =========================================================
   LIST MY INVITES — logged-in student's PENDING invites.
   GET /teams/invites/mine
========================================================= */

export async function listMyInvites(req, res) {
  try {
    const userId = req.user.id;

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can view team invites",
      });
    }

    const invitesResult = await pool.query(
      `
      SELECT
        ti.id,
        ti.team_id,
        ti.invited_user_id,
        ti.invited_by,
        ti.status,
        ti.created_at,
        ti.responded_at,

        t.name AS team_name,
        t.hackathon_id,

        h.title AS hackathon_title,

        leader.name AS leader_name

      FROM team_invites ti

      INNER JOIN teams t
        ON t.id = ti.team_id

      INNER JOIN hackathons h
        ON h.id = t.hackathon_id

      LEFT JOIN users leader
        ON leader.id = ti.invited_by

      WHERE ti.invited_user_id = $1
        AND ti.status = 'PENDING'
      ORDER BY ti.created_at DESC
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      invites: invitesResult.rows,
    });
  } catch (error) {
    console.error("LIST MY INVITES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load your team invites",
    });
  }
}

/* =========================================================
   ACCEPT INVITE — invitee only, in a transaction.
   POST /teams/invites/:inviteId/accept
========================================================= */

export async function acceptTeamInvite(req, res) {
  const client = await pool.connect();

  try {
    const { inviteId } = req.params;
    const userId = req.user.id;

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can accept team invites",
      });
    }

    await client.query("BEGIN");

    const inviteResult = await client.query(
      `
      SELECT
        id,
        team_id,
        invited_user_id,
        invited_by,
        status
      FROM team_invites
      WHERE id = $1
      FOR UPDATE
      `,
      [inviteId]
    );

    if (inviteResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Invite not found",
      });
    }

    const invite = inviteResult.rows[0];

    if (String(invite.invited_user_id) !== String(userId)) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message: "Only the invited student can accept this invite",
      });
    }

    if (invite.status !== "PENDING") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "This invite is no longer pending",
      });
    }

    /* -------------------------------------------------------
       TEAM — re-check BUILDING + room, under the team lock.
    ------------------------------------------------------- */

    const team = await loadInviteTeam(client, invite.team_id);

    if (!team) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    if (team.hackathon_event_type === "quiz") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Teams are not available for quiz events",
      });
    }

    if (team.status !== "BUILDING") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "This team is no longer accepting members",
      });
    }

    /* -------------------------------------------------------
       INVITEE — re-check still eligible + still team-free.
    ------------------------------------------------------- */

    const { error } = await validateInvitee(client, team, userId);

    if (error) {
      await client.query("ROLLBACK");

      return res.status(error.status).json({
        success: false,
        message: error.message,
        ...(error.team ? { team: error.team } : {}),
      });
    }

    /* -------------------------------------------------------
       ROOM — members only here: this invite is about to
       become the next member.
    ------------------------------------------------------- */

    const memberCountResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM team_members
      WHERE team_id = $1
      `,
      [team.id]
    );

    // v6.39 — the cap comes from the event, not a hardcoded 4.
    const teamCap = Number(team.hackathon_max_team_size) || 4;

    if (memberCountResult.rows[0].count >= teamCap) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          `This team is already full. Maximum team size is ${teamCap}.`,
      });
    }

    /* -------------------------------------------------------
       JOIN + MARK ACCEPTED
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
      [team.id, userId]
    );

    const updatedInvite = await client.query(
      `
      UPDATE team_invites
      SET status = 'ACCEPTED',
          responded_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        team_id,
        invited_user_id,
        invited_by,
        status,
        created_at,
        responded_at
      `,
      [invite.id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,

      message: `You joined ${team.name}.`,

      member: memberResult.rows[0],
      invite: updatedInvite.rows[0],

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

    console.error("ACCEPT TEAM INVITE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to accept team invite",
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   DECLINE INVITE — invitee only.
   POST /teams/invites/:inviteId/decline
========================================================= */

export async function declineTeamInvite(req, res) {
  try {
    const { inviteId } = req.params;
    const userId = req.user.id;

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can decline team invites",
      });
    }

    const result = await pool.query(
      `
      UPDATE team_invites
      SET status = 'DECLINED',
          responded_at = NOW()
      WHERE id = $1
        AND invited_user_id = $2
        AND status = 'PENDING'
      RETURNING
        id,
        team_id,
        invited_user_id,
        invited_by,
        status,
        created_at,
        responded_at
      `,
      [inviteId, userId]
    );

    if (result.rows.length === 0) {
      const existing = await pool.query(
        `
        SELECT invited_user_id, status
        FROM team_invites
        WHERE id = $1
        `,
        [inviteId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Invite not found",
        });
      }

      if (
        String(existing.rows[0].invited_user_id) !== String(userId)
      ) {
        return res.status(403).json({
          success: false,
          message: "Only the invited student can decline this invite",
        });
      }

      return res.status(409).json({
        success: false,
        message: "This invite is no longer pending",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Invite declined.",
      invite: result.rows[0],
    });
  } catch (error) {
    console.error("DECLINE TEAM INVITE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to decline team invite",
    });
  }
}

/* =========================================================
   CANCEL INVITE — leader only.
   POST /teams/invites/:inviteId/cancel
========================================================= */

export async function cancelTeamInvite(req, res) {
  const client = await pool.connect();

  try {
    const { inviteId } = req.params;
    const userId = req.user.id;

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can cancel team invites",
      });
    }

    await client.query("BEGIN");

    const inviteResult = await client.query(
      `
      SELECT
        id,
        team_id,
        invited_user_id,
        invited_by,
        status
      FROM team_invites
      WHERE id = $1
      FOR UPDATE
      `,
      [inviteId]
    );

    if (inviteResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Invite not found",
      });
    }

    const invite = inviteResult.rows[0];

    const teamResult = await client.query(
      `
      SELECT id, leader_id
      FROM teams
      WHERE id = $1
      `,
      [invite.team_id]
    );

    if (
      teamResult.rows.length === 0 ||
      String(teamResult.rows[0].leader_id) !== String(userId)
    ) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message: "Only the team leader can cancel invites",
      });
    }

    if (invite.status !== "PENDING") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "This invite is no longer pending",
      });
    }

    const updated = await client.query(
      `
      UPDATE team_invites
      SET status = 'CANCELLED'
      WHERE id = $1
      RETURNING
        id,
        team_id,
        invited_user_id,
        invited_by,
        status,
        created_at,
        responded_at
      `,
      [invite.id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Invite cancelled.",
      invite: updated.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("CANCEL TEAM INVITE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to cancel team invite",
    });
  } finally {
    client.release();
  }
}
