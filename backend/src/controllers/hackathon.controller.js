import pool from "../config/db.js";
import { getPagination, buildPaginationMeta } from "../utils/pagination.js";

export async function createHackathon(req, res) {
  try {
    const {
      title,
      description,
      track,
      location,
      expected_date,
      start_date,
      end_date,
      registration_deadline,
      max_teams,
      show_timer,
      banner_web_url,
      banner_mobile_url,
      max_team_size,
      invite_only,
    } = req.body;

    // v6.17 — quiz events: same row, event_type = 'quiz'. Quiz-only
    // settings (duration, negative marking, participant cap) ride
    // in the settings JSONB column; max_teams doubles as the cap.
    const isQuiz = req.body?.event_type === "quiz";
    const rawSettings =
      req.body?.settings && typeof req.body.settings === "object"
        ? req.body.settings
        : {};
    const quizSettings = {};
    if (isQuiz) {
      const duration = Number(rawSettings.duration_minutes);
      if (Number.isFinite(duration) && duration > 0) {
        quizSettings.duration_minutes = Math.floor(duration);
      }
      const negative = Number(rawSettings.negative_marks);
      if (Number.isFinite(negative) && negative >= 0) {
        quizSettings.negative_marks = negative;
      }
      const cap = Number(rawSettings.max_participants);
      if (Number.isFinite(cap) && cap > 0) {
        quizSettings.max_participants = Math.floor(cap);
      }
    }

    if (
      !title ||
      !String(title).trim() ||
      !description ||
      !String(description).trim() ||
      !track ||
      !String(track).trim() ||
      (!isQuiz &&
        (max_teams === undefined || max_teams === null || max_teams === ""))
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title, description, track and maximum teams are required",
      });
    }

    const maximumTeams =
      max_teams === undefined || max_teams === null || max_teams === ""
        ? quizSettings.max_participants || 100
        : Number(max_teams);

    if (!Number.isFinite(maximumTeams) || maximumTeams < 1) {
      return res.status(400).json({
        success: false,
        message: "Maximum teams must be at least 1",
      });
    }

    // v6.39 — participant type: 1 = Individual (solo), 2-4 = team
    // cap. Quizzes are solo by design and ignore this field.
    let teamSize = 4;
    if (
      !isQuiz &&
      max_team_size !== undefined &&
      max_team_size !== null &&
      max_team_size !== ""
    ) {
      teamSize = Number(max_team_size);
      if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 4) {
        return res.status(400).json({
          success: false,
          message: "Team size must be between 1 and 4",
        });
      }
    }

    // v6.44 — round times are validated before anything is
    // inserted, so a bad round can never orphan an event row.
    if (!isQuiz && Array.isArray(req.body?.rounds)) {
      for (let i = 0; i < req.body.rounds.length; i++) {
        const r = req.body.rounds[i] || {};
        if (r.start_at && r.end_at && new Date(r.start_at) >= new Date(r.end_at)) {
          return res.status(400).json({
            success: false,
            message: `Round ${i + 1} end time must be after start time`,
          });
        }
      }
    }

    const expectedDate = expected_date || start_date || null;
    const optionalEndDate = end_date || null;
    const optionalRegistrationDeadline =
      registration_deadline || null;

    const result = await pool.query(
      `
      INSERT INTO hackathons (
        title,
        description,
        organizer_id,
        track,
        location,
        start_date,
        end_date,
        registration_deadline,
        max_teams,
        status,
        current_round,
        event_type,
        settings,
        show_timer,
        banner_web_url,
        banner_mobile_url,
        max_team_size,
        invite_only
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18)
      RETURNING *
      `,
      [
        String(title).trim(),
        String(description).trim(),
        req.user.id,
        String(track).trim(),
        location && String(location).trim()
          ? String(location).trim()
          : null,
        expectedDate,
        optionalEndDate,
        optionalRegistrationDeadline,
        maximumTeams,
        "DRAFT",
        1,
        isQuiz ? "quiz" : "hackathon",
        JSON.stringify(quizSettings),
        show_timer === true || show_timer === "true",
        banner_web_url && String(banner_web_url).trim()
          ? String(banner_web_url).trim()
          : null,
        banner_mobile_url && String(banner_mobile_url).trim()
          ? String(banner_mobile_url).trim()
          : null,
        teamSize,
        invite_only === true || invite_only === "true",
      ]
    );

    // v6.38 — rounds chosen at creation (hackathons only; quizzes
    // are solo timed attempts and never use rounds). 1-3 rounds,
    // each with its own name, requirement and AI-usage flag.
    // v6.44 — each round also carries its own start/end time
    // and timer switch.
    const createdRounds = req.body?.rounds;
    if (!isQuiz && Array.isArray(createdRounds) && createdRounds.length >= 1 && createdRounds.length <= 3) {
      const newHackathonId = result.rows[0].id;
      for (let i = 0; i < createdRounds.length; i++) {
        const r = createdRounds[i] || {};
        const roundTimer = r.show_timer === true || r.show_timer === "true"
          ? true
          : r.show_timer === false || r.show_timer === "false"
            ? false
            : null;
        await pool.query(
          `
          INSERT INTO hackathon_rounds (
            hackathon_id, round_number, title,
            requirement, ai_usage_required, status,
            start_at, end_at, show_timer, submission_type
          )
          VALUES ($1,$2,$3,$4,$5,'SCHEDULED',$6,$7,$8,$9)
          ON CONFLICT (hackathon_id, round_number) DO NOTHING
          `,
          [
            newHackathonId,
            i + 1,
            r.title && String(r.title).trim()
              ? String(r.title).trim()
              : `Round ${i + 1}`,
            r.requirement && String(r.requirement).trim()
              ? String(r.requirement).trim()
              : null,
            r.ai_usage_required === true || r.ai_usage_required === "true",
            r.start_at || null,
            r.end_at || null,
            roundTimer,
            r.submission_type === "demo" ? "demo" : "idea",
          ]
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: "Hackathon created successfully",
      hackathon: {
        ...result.rows[0],
        expected_date: result.rows[0].start_date,
      },
    });
  } catch (error) {
    console.error("CREATE HACKATHON ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create hackathon",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}

export async function joinHackathon(req, res) {
  try {
    const { id } = req.params;

    const hackathonResult = await pool.query(
      `
      SELECT
        id,
        title,
        status,
        publication_status,
        registration_deadline,
        max_teams,
        event_type,
        settings
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (hackathonResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = hackathonResult.rows[0];

    if (hackathon.publication_status !== "PUBLISHED") {
      return res.status(400).json({
        success: false,
        message: "Hackathon is not published yet",
      });
    }

    // v6.8 fix: registration stays open while hackathon is OPEN or LIVE.
    // (Going LIVE used to flip status to LIVE and silently block all joins.)
    if (!["OPEN", "LIVE"].includes(hackathon.status)) {
      return res.status(400).json({
        success: false,
        message: "Hackathon registration is not open",
      });
    }

    if (
      hackathon.registration_deadline &&
      new Date() > new Date(hackathon.registration_deadline)
    ) {
      return res.status(400).json({
        success: false,
        message: "Hackathon registration deadline has passed",
      });
    }

    const existing = await pool.query(
      `
      SELECT id
      FROM hackathon_participants
      WHERE hackathon_id = $1
        AND user_id = $2
      `,
      [id, req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You are already registered for this hackathon",
      });
    }

    // v6.38 — invite-code-only events (paid hackathons): only a
    // student holding a code issued for their own email may join.
    // The event organizer and admins bypass the code check.
    // Validation happens here; the code is marked used only after
    // the participant row is inserted successfully below.
    let inviteCodeRow = null;
    const inviteOnlyHackathon = await pool.query(
      `
      SELECT organizer_id, invite_only
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );
    const inviteRow = inviteOnlyHackathon.rows[0];
    if (
      inviteRow?.invite_only &&
      req.user.id !== inviteRow.organizer_id &&
      req.user.role !== "ADMIN"
    ) {
      const code = String(req.body?.invite_code || "").trim().toUpperCase();
      if (!code) {
        return res.status(403).json({
          success: false,
          message:
            "This hackathon is invite-only. Enter the invite code you received after payment.",
        });
      }
      const userResult = await pool.query(
        `SELECT email FROM users WHERE id = $1`,
        [req.user.id]
      );
      const userEmail = String(userResult.rows[0]?.email || "").toLowerCase();
      const codeResult = await pool.query(
        `
        SELECT id, email, used_by
        FROM event_invite_codes
        WHERE hackathon_id = $1 AND UPPER(code) = $2
        `,
        [id, code]
      );
      const codeRow = codeResult.rows[0];
      if (!codeRow) {
        return res.status(403).json({
          success: false,
          message:
            "Invalid invite code. You are not eligible for this event.",
        });
      }
      if (String(codeRow.email || "").toLowerCase() !== userEmail) {
        return res.status(403).json({
          success: false,
          message: "This invite code belongs to another email.",
        });
      }
      if (codeRow.used_by) {
        return res.status(403).json({
          success: false,
          message: "This invite code has already been used.",
        });
      }
      inviteCodeRow = codeRow;
    }

    // v6.17 — quiz participant cap (hackathon joins stay uncapped,
    // exactly as before). Cap lives in settings, falls back to
    // max_teams which the create endpoint fills from the cap.
    if (hackathon.event_type === "quiz") {
      const settings =
        hackathon.settings && typeof hackathon.settings === "object"
          ? hackathon.settings
          : {};
      const cap =
        Number(settings.max_participants) || Number(hackathon.max_teams);
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS count
           FROM hackathon_participants WHERE hackathon_id = $1`,
        [id]
      );
      if (countResult.rows[0].count >= cap) {
        return res.status(400).json({
          success: false,
          message: "The quiz participant limit has been reached",
        });
      }
    }

    const participant = await pool.query(
      `
      INSERT INTO hackathon_participants (
        hackathon_id,
        user_id
      )
      VALUES ($1,$2)
      RETURNING *
      `,
      [id, req.user.id]
    );

    // v6.38 — mark the invite code used only now that the join
    // actually succeeded, so a failed join never burns a code.
    if (inviteCodeRow) {
      await pool.query(
        `
        UPDATE event_invite_codes
        SET used_by = $2, used_at = NOW()
        WHERE id = $1 AND used_by IS NULL
        `,
        [inviteCodeRow.id, req.user.id]
      );
    }

    return res.status(201).json({
      success: true,
      message: "Successfully registered for hackathon",
      participant: participant.rows[0],
    });
  } catch (error) {
    console.error("JOIN HACKATHON ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to join hackathon",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}

export async function leaveHackathon(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const participant = await pool.query(
      `
      SELECT id
      FROM hackathon_participants
      WHERE hackathon_id = $1
        AND user_id = $2
      `,
      [id, userId]
    );

    if (participant.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "You are not registered for this hackathon",
      });
    }

    await pool.query(
      `
      DELETE FROM hackathon_participants
      WHERE hackathon_id = $1
        AND user_id = $2
      `,
      [id, userId]
    );

    return res.json({
      success: true,
      message: "Successfully left hackathon",
    });
  } catch (error) {
    console.error("LEAVE HACKATHON ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to leave hackathon",
    });
  }
}
export async function getHackathonParticipants(req, res) {
  try {
    const { id } = req.params;

    // Check whether hackathon exists
    const hackathonResult = await pool.query(
      `
      SELECT
        id,
        title
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (hackathonResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    // Get registered participants
    // IMPORTANT:
    // hackathon_participants uses joined_at, NOT created_at.
    const result = await pool.query(
      `
      SELECT
        hp.id,
        hp.hackathon_id,
        hp.user_id,
        hp.status,
        hp.joined_at,
        u.name,
        u.email,
        u.avatar_url
      FROM hackathon_participants hp
      INNER JOIN users u
        ON u.id = hp.user_id
      WHERE hp.hackathon_id = $1
      ORDER BY hp.joined_at ASC
      `,
      [id]
    );

    return res.json({
      success: true,
      hackathon: hackathonResult.rows[0],
      count: result.rows.length,
      participants: result.rows,
    });
  } catch (error) {
    console.error(
      "GET HACKATHON PARTICIPANTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch participants",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}

export async function getHackathonTeams(req, res) {
  try {
    const { id } = req.params;

    const hackathonResult = await pool.query(
      `
      SELECT id,title
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (hackathonResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const result = await pool.query(
      `
      SELECT
        t.id,
        t.hackathon_id,
        t.name,
        t.leader_id,
        t.status,
        t.created_at,
        t.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'user_id',u.id,
              'name',u.name,
              'email',u.email,
              'avatar_url',u.avatar_url,
              'role',tm.role,
              'joined_at',tm.joined_at
            )
            ORDER BY tm.joined_at ASC
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS members
      FROM teams t
      LEFT JOIN team_members tm ON tm.team_id = t.id
      LEFT JOIN users u ON u.id = tm.user_id
      WHERE t.hackathon_id = $1
      GROUP BY
        t.id,
        t.hackathon_id,
        t.name,
        t.leader_id,
        t.status,
        t.created_at,
        t.updated_at
      ORDER BY t.created_at ASC
      `,
      [id]
    );

    return res.json({
      success: true,
      hackathon: {
        id: hackathonResult.rows[0].id,
        title: hackathonResult.rows[0].title,
      },
      count: result.rows.length,
      teams: result.rows,
    });
  } catch (error) {
    console.error("GET HACKATHON TEAMS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch hackathon teams",
    });
  }
}

/* =========================================================
   CREATE TEAM
   ========================================================= */

export async function createTeam(req, res) {
  const client = await pool.connect();

  try {
    const { id: hackathonId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Only students can create teams",
      });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Team name is required",
      });
    }

    const teamName = String(name).trim();

    await client.query("BEGIN");

    const hackathonResult = await client.query(
      `
      SELECT
        id,
        title,
        status,
        publication_status,
        max_teams
      FROM hackathons
      WHERE id = $1
      FOR UPDATE
      `,
      [hackathonId]
    );

    if (hackathonResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = hackathonResult.rows[0];

    if (hackathon.publication_status !== "PUBLISHED") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Hackathon is not published yet",
      });
    }

    // v6.8 fix: see above — LIVE hackathons must accept joins too.
    if (!["OPEN", "LIVE"].includes(hackathon.status)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "Teams can only be created while the hackathon is open for registration",
      });
    }

    /* =========================================================
       STUDENT MUST BE REGISTERED
       ========================================================= */

    const participantResult = await client.query(
      `
      SELECT id
      FROM hackathon_participants
      WHERE hackathon_id = $1
        AND user_id = $2
      FOR UPDATE
      `,
      [hackathonId, userId]
    );

    if (participantResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message:
          "You must register for the hackathon before creating a team",
      });
    }

    /* =========================================================
       CHECK EXISTING TEAM MEMBERSHIP
       ========================================================= */

    const existingMemberResult = await client.query(
      `
      SELECT
        t.id,
        t.name
      FROM teams t
      INNER JOIN team_members tm
        ON tm.team_id = t.id
      WHERE t.hackathon_id = $1
        AND tm.user_id = $2
      LIMIT 1
      `,
      [hackathonId, userId]
    );

    if (existingMemberResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message:
          "You are already a member of a team in this hackathon",
        team: existingMemberResult.rows[0],
      });
    }

    /* =========================================================
       DUPLICATE TEAM NAME
       ========================================================= */

    const duplicateNameResult = await client.query(
      `
      SELECT id, name
      FROM teams
      WHERE hackathon_id = $1
        AND LOWER(name) = LOWER($2)
      LIMIT 1
      `,
      [hackathonId, teamName]
    );

    if (duplicateNameResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message:
          "A team with this name already exists in this hackathon",
      });
    }

    /* =========================================================
       MAXIMUM NUMBER OF TEAMS
       ========================================================= */

    const teamCountResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM teams
      WHERE hackathon_id = $1
      `,
      [hackathonId]
    );

    const currentTeamCount = Number(
      teamCountResult.rows[0].count
    );

    if (
      hackathon.max_teams !== null &&
      hackathon.max_teams !== undefined &&
      currentTeamCount >= Number(hackathon.max_teams)
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "Maximum number of teams has already been reached",
      });
    }

    /* =========================================================
       CREATE TEAM

       IMPORTANT:
       teams uses leader_id, NOT created_by.
       ========================================================= */

    const teamResult = await client.query(
      `
      INSERT INTO teams (
        hackathon_id,
        name,
        leader_id,
        status
      )
      VALUES ($1, $2, $3, 'BUILDING')
      RETURNING
        id,
        hackathon_id,
        name,
        leader_id,
        status,
        created_at,
        updated_at
      `,
      [hackathonId, teamName, userId]
    );

    const team = teamResult.rows[0];

    /* =========================================================
       ADD CREATOR AS TEAM LEADER
       ========================================================= */

    const memberResult = await client.query(
      `
      INSERT INTO team_members (
        team_id,
        user_id,
        role
      )
      VALUES ($1, $2, 'LEADER')
      RETURNING
        id,
        team_id,
        user_id,
        role,
        joined_at
      `,
      [team.id, userId]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Team created successfully",
      team: {
        ...team,
        members: [memberResult.rows[0]],
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("CREATE TEAM ERROR:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "A team with this name already exists or membership already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create team",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  } finally {
    client.release();
  }
}

export async function getHackathons(req, res) {
  try {
    const { page, limit, offset } = getPagination(req);

    const countResult = await pool.query(
      "SELECT COUNT(*)::int AS total FROM hackathons"
    );
    const total = countResult.rows[0]?.total || 0;

    const result = await pool.query(
      `
      SELECT
        h.id,
        h.title,
        h.description,
        h.organizer_id,
        u.name AS organizer_name,
        h.track,
        h.location,
        h.start_date AS expected_date,
        h.start_date,
        h.end_date,
        h.registration_deadline,
        h.max_teams,
        h.status,
        h.approval_status,
        h.publication_status,
        h.current_round,
        h.event_type,
        h.banner_web_url,
        h.banner_mobile_url,
        h.invite_only,
        h.max_team_size,
        h.created_at,
        h.updated_at
      FROM hackathons h
      JOIN users u ON u.id = h.organizer_id
      ORDER BY h.created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    return res.json({
      success: true,
      count: result.rows.length,
      hackathons: result.rows,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error("GET HACKATHONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch hackathons",
    });
  }
}
/*
|--------------------------------------------------------------------------
| PUBLIC - LIVE HACKATHONS (LANDING PAGE)
|--------------------------------------------------------------------------
|
| GET /api/hackathons/public — no auth. The public landing page lists
| live events here. Only published, open/live hackathons, and only
| public fields (no organizer emails, no invite codes, no internals).
*/
export async function getPublicHackathons(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        h.id,
        h.title,
        h.description,
        h.track,
        h.location,
        h.start_date,
        h.end_date,
        h.status,
        h.event_type,
        h.max_team_size,
        h.banner_web_url
      FROM hackathons h
      WHERE h.publication_status = 'PUBLISHED'
        AND h.status IN ('OPEN', 'LIVE')
        AND h.event_type = 'hackathon'
      ORDER BY h.created_at DESC
      LIMIT 6
      `
    );

    return res.json({
      success: true,
      count: result.rows.length,
      hackathons: result.rows,
    });
  } catch (error) {
    console.error("GET PUBLIC HACKATHONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch hackathons",
    });
  }
}

/* ============================================================
   UPDATE EVENT BANNERS (v6.18 — banner system)
   PATCH /api/hackathons/:id/banner
   Organizer sets two banner image URLs for their own event:
   banner_web_url (desktop) and banner_mobile_url (mobile).
   Either may be an empty string to clear it. Omitted fields
   keep their current value. Display-only: editable in any
   state (draft, published, live) — banners never affect
   scoring, registration, or rounds.
   ============================================================ */

/* v6.21 — organizer date editor: change start/end on an existing
   event without recreating it. Organizer of the event, or ADMIN.
   Body: { start_date, end_date } — ISO strings; "" clears a date.
   Undefined = keep. Blocked while LIVE (mid-event window changes
   would corrupt running attempts). */
export async function updateHackathonDates(req, res) {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.body || {};

    const cleanDate = (value, label) => {
      if (value === undefined || value === null) return undefined;
      const text = String(value).trim();
      if (text === "") return null;
      const parsed = new Date(text);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`${label} is not a valid date/time.`);
      }
      return text;
    };

    let nextStart;
    let nextEnd;
    try {
      nextStart = cleanDate(start_date, "Start time");
      nextEnd = cleanDate(end_date, "End time");
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message,
      });
    }

    if (nextStart === undefined && nextEnd === undefined) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update. Send start_date and/or end_date.",
      });
    }

    const existing = await pool.query(
      `
      SELECT
        id,
        organizer_id,
        status,
        start_date,
        end_date
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = existing.rows[0];

    if (
      req.user.role !== "ADMIN" &&
      String(hackathon.organizer_id) !== String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Only this event's organizer can change its dates.",
      });
    }

    if (String(hackathon.status || "").toUpperCase() === "LIVE") {
      return res.status(400).json({
        success: false,
        message: "Cannot change dates while the event is live.",
      });
    }

    const finalStart = nextStart === undefined ? hackathon.start_date : nextStart;
    const finalEnd = nextEnd === undefined ? hackathon.end_date : nextEnd;

    if (finalStart && finalEnd && new Date(finalEnd) <= new Date(finalStart)) {
      return res.status(400).json({
        success: false,
        message: "End time must be after the start time.",
      });
    }

    const result = await pool.query(
      `
      UPDATE hackathons
      SET
        start_date = $1,
        end_date = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING id, title, start_date, end_date
      `,
      [finalStart, finalEnd, id]
    );

    return res.json({
      success: true,
      hackathon: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE HACKATHON DATES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update dates",
    });
  }
}

export async function updateHackathonBanner(req, res) {
  try {
    const { id } = req.params;
    const { banner_web_url, banner_mobile_url } = req.body || {};

    const cleanUrl = (value) => {
      if (value === undefined || value === null) return undefined;
      const url = String(value).trim();
      if (url === "") return null;
      if (url.length > 2048) {
        throw new Error("Banner URL is too long (max 2048 characters).");
      }
      if (!/^https?:\/\//i.test(url)) {
        throw new Error("Banner URL must start with http:// or https://.");
      }
      return url;
    };

    let nextWeb;
    let nextMobile;
    try {
      nextWeb = cleanUrl(banner_web_url);
      nextMobile = cleanUrl(banner_mobile_url);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message,
      });
    }

    if (nextWeb === undefined && nextMobile === undefined) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update. Send banner_web_url and/or banner_mobile_url.",
      });
    }

    const existing = await pool.query(
      `
      SELECT
        id,
        organizer_id,
        banner_web_url,
        banner_mobile_url
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = existing.rows[0];

    if (
      req.user.role !== "ADMIN" &&
      String(hackathon.organizer_id) !== String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Only this event's organizer can change its banners.",
      });
    }

    const result = await pool.query(
      `
      UPDATE hackathons
      SET
        banner_web_url = $1,
        banner_mobile_url = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING id, title, banner_web_url, banner_mobile_url
      `,
      [
        nextWeb === undefined ? hackathon.banner_web_url : nextWeb,
        nextMobile === undefined ? hackathon.banner_mobile_url : nextMobile,
        id,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Banners saved.",
      hackathon: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE HACKATHON BANNER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Could not save banners.",
    });
  }
}

export async function getHackathonById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        h.id,
        h.title,
        h.description,
        h.organizer_id,
        u.name AS organizer_name,
        h.track,
        h.location,
        h.start_date AS expected_date,
        h.start_date,
        h.end_date,
        h.registration_deadline,
        h.max_teams,
        h.event_type,
        h.settings,
        h.banner_web_url,
        h.banner_mobile_url,
        h.show_timer,
        h.invite_only,
        h.max_team_size,
        h.status,
        h.approval_status,
        h.approval_feedback,
        h.publication_status,
        h.published_at,
        h.current_round,
        h.created_at,
        h.updated_at
      FROM hackathons h
      JOIN users u ON u.id = h.organizer_id
      WHERE h.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    return res.json({
      success: true,
      hackathon: result.rows[0],
    });
  } catch (error) {
    console.error("GET HACKATHON BY ID ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch hackathon",
    });
  }
}

export async function updateHackathon(req, res) {
  try {
    const { id } = req.params;

    const {
      title,
      description,
      track,
      location,
      expected_date,
      start_date,
      end_date,
      registration_deadline,
      max_teams,
      max_team_size,
      invite_only,
    } = req.body;

    const existing = await pool.query(
      `
      SELECT
        id, title, description, organizer_id, track, location,
        start_date, end_date, registration_deadline, max_teams,
        max_team_size, invite_only,
        status, approval_status, approval_feedback,
        approved_by, approved_at, publication_status,
        published_at, published_by, current_round, settings,
        created_at, updated_at
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = existing.rows[0];

    if (
      req.user.role !== "ADMIN" &&
      hackathon.organizer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own hackathons",
      });
    }

    if (hackathon.publication_status === "PUBLISHED") {
      return res.status(400).json({
        success: false,
        message: "Published hackathons cannot be edited",
      });
    }

    const updatedTitle =
      title !== undefined
        ? String(title).trim()
        : hackathon.title;

    const updatedDescription =
      description !== undefined
        ? String(description).trim()
        : hackathon.description;

    const updatedTrack =
      track !== undefined
        ? String(track).trim()
        : hackathon.track;

    const updatedLocation =
      location !== undefined
        ? location
          ? String(location).trim()
          : null
        : hackathon.location;

    const updatedExpectedDate =
      expected_date !== undefined
        ? expected_date || null
        : start_date !== undefined
          ? start_date || null
          : hackathon.start_date;

    const updatedEndDate =
      end_date !== undefined
        ? end_date || null
        : hackathon.end_date;

    const updatedDeadline =
      registration_deadline !== undefined
        ? registration_deadline || null
        : hackathon.registration_deadline;

    const updatedMaxTeams =
      max_teams !== undefined
        ? Number(max_teams)
        : Number(hackathon.max_teams);

    if (
      !Number.isFinite(updatedMaxTeams) ||
      updatedMaxTeams < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Maximum teams must be at least 1",
      });
    }

    // v6.39 — DRAFT-only edit (published events are blocked above,
    // so no team can already exist over a lowered cap).
    const updatedTeamSize =
      max_team_size !== undefined
        ? Number(max_team_size)
        : Number(hackathon.max_team_size) || 4;

    if (
      !Number.isInteger(updatedTeamSize) ||
      updatedTeamSize < 1 ||
      updatedTeamSize > 4
    ) {
      return res.status(400).json({
        success: false,
        message: "Team size must be between 1 and 4",
      });
    }

    // v6.39 — invite-only may also change while DRAFT; the same
    // published-block above keeps live events untouched.
    const updatedInviteOnly =
      invite_only !== undefined ? !!invite_only : !!hackathon.invite_only;

    const result = await pool.query(
      `
      UPDATE hackathons
      SET
        title = $1,
        description = $2,
        track = $3,
        location = $4,
        start_date = $5,
        end_date = $6,
        registration_deadline = $7,
        max_teams = $8,
        max_team_size = $9,
        invite_only = $10,
        updated_at = NOW()
      WHERE id = $11
      RETURNING *
      `,
      [
        updatedTitle,
        updatedDescription,
        updatedTrack,
        updatedLocation,
        updatedExpectedDate,
        updatedEndDate,
        updatedDeadline,
        updatedMaxTeams,
        updatedTeamSize,
        updatedInviteOnly,
        id,
      ]
    );

    return res.json({
      success: true,
      message: "Hackathon updated successfully",
      hackathon: {
        ...result.rows[0],
        expected_date: result.rows[0].start_date,
      },
    });
  } catch (error) {
    console.error("UPDATE HACKATHON ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update hackathon",
    });
  }
}

export async function deleteHackathon(req, res) {
  try {
    const { id } = req.params;

    const existing = await pool.query(
      `
      SELECT
        id,
        organizer_id,
        publication_status,
        status
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = existing.rows[0];

    if (
      req.user.role !== "ADMIN" &&
      hackathon.organizer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own hackathons",
      });
    }

    if (
      req.user.role !== "ADMIN" &&
      (
        hackathon.publication_status === "PUBLISHED" ||
        hackathon.status === "LIVE"
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Published or live hackathons cannot be deleted",
      });
    }

    await pool.query(
      `
      DELETE FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    return res.json({
      success: true,
      message: "Hackathon deleted successfully",
    });
  } catch (error) {
    console.error("DELETE HACKATHON ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete hackathon",
    });
  }
}

export async function updateHackathonStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "DRAFT",
      "OPEN",
      "LIVE",
      "PAUSED",
      "COMPLETED",
    ];

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const normalizedStatus = String(status)
      .trim()
      .toUpperCase();

    if (!allowedStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hackathon status",
        allowedStatuses,
      });
    }

    const existing = await pool.query(
      `
      SELECT
        id,
        organizer_id,
        status,
        approval_status,
        publication_status
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = existing.rows[0];

    if (
      req.user.role !== "ADMIN" &&
      hackathon.organizer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only change the status of your own hackathons",
      });
    }

    if (
      normalizedStatus === "OPEN" &&
      hackathon.publication_status !== "PUBLISHED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Hackathon must be published before opening registration",
      });
    }

    if (
      normalizedStatus === "LIVE" &&
      hackathon.publication_status !== "PUBLISHED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Hackathon must be published before going LIVE",
      });
    }

    if (normalizedStatus === "COMPLETED") {
      const roundResult = await pool.query(
        `
        SELECT status
        FROM hackathon_rounds
        WHERE hackathon_id = $1
          AND round_number = 3
        `,
        [id]
      );

      if (
        roundResult.rows.length > 0 &&
        roundResult.rows[0].status !== "COMPLETED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Round 3 must be completed before completing the hackathon",
        });
      }
    }

    const result = await pool.query(
      `
      UPDATE hackathons
      SET
        status = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [normalizedStatus, id]
    );

    return res.json({
      success: true,
      message: "Hackathon status updated successfully",
      hackathon: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE HACKATHON STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update hackathon status",
    });
  }
}

export async function submitHackathonForApproval(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        id, title, description, organizer_id, track, location,
        start_date, end_date, registration_deadline, max_teams,
        status, approval_status, approval_feedback,
        approved_by, approved_at, publication_status,
        published_at, published_by, current_round, settings,
        created_at, updated_at
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = result.rows[0];

    if (
      req.user.role !== "ADMIN" &&
      hackathon.organizer_id !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only submit your own hackathons",
      });
    }

    if (hackathon.approval_status === "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Hackathon is already waiting for approval",
      });
    }

    if (hackathon.approval_status === "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Hackathon has already been approved",
      });
    }

    await pool.query(
      `
      UPDATE hackathons
      SET
        approval_status = 'PENDING',
        approval_feedback = NULL,
        updated_at = NOW()
      WHERE id = $1
      `,
      [id]
    );

    return res.json({
      success: true,
      message: "Hackathon submitted for admin approval",
    });
  } catch (error) {
    console.error(
      "SUBMIT HACKATHON APPROVAL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to submit hackathon for approval",
    });
  }
}

export async function publishHackathon(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        id, title, description, organizer_id, track, location,
        start_date, end_date, registration_deadline, max_teams,
        status, approval_status, approval_feedback,
        approved_by, approved_at, publication_status,
        published_at, published_by, current_round, settings,
        created_at, updated_at
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = result.rows[0];

    if (
      req.user.role !== "ADMIN" &&
      hackathon.organizer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only publish your own hackathons",
      });
    }

    if (hackathon.approval_status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message:
          "Hackathon must be approved before publishing",
      });
    }

    if (hackathon.publication_status === "PUBLISHED") {
      return res.status(400).json({
        success: false,
        message: "Hackathon is already published",
      });
    }

    const published = await pool.query(
      `
      UPDATE hackathons
      SET
        publication_status = 'PUBLISHED',
        published_at = NOW(),
        published_by = $1,
        status = 'OPEN',
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [req.user.id, id]
    );

    return res.json({
      success: true,
      message: "Hackathon published successfully",
      hackathon: published.rows[0],
    });
  } catch (error) {
    console.error("PUBLISH HACKATHON ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to publish hackathon",
    });
  }
}

export async function getOrganizerHackathons(req, res) {
  try {
    const organizerId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        h.id,
        h.title,
        h.description,
        h.organizer_id,
        h.track,
        h.location,
        h.start_date AS expected_date,
        h.start_date,
        h.end_date,
        h.registration_deadline,
        h.max_teams,
        h.status,
        h.approval_status,
        h.approval_feedback,
        h.approved_by,
        h.approved_at,
        h.publication_status,
        h.published_at,
        h.published_by,
        h.current_round,
        h.event_type,
        h.settings,
        h.banner_web_url,
        h.banner_mobile_url,
        h.show_timer,
        h.invite_only,
        h.max_team_size,
        h.created_at,
        h.updated_at,
        (
          SELECT COUNT(*)::int
          FROM hackathon_participants p
          WHERE p.hackathon_id = h.id
        ) AS participant_count,
        (
          SELECT COUNT(*)::int
          FROM teams t
          WHERE t.hackathon_id = h.id
        ) AS team_count
      FROM hackathons h
      WHERE h.organizer_id = $1
      ORDER BY h.created_at DESC
      `,
      [organizerId]
    );

    return res.json({
      success: true,
      count: result.rows.length,
      hackathons: result.rows,
    });
  } catch (error) {
    console.error(
      "GET ORGANIZER HACKATHONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch organizer hackathons",
    });
  }
}

export async function getPendingHackathonApprovals(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        h.id,
        h.title,
        h.description,
        h.organizer_id,
        u.name AS organizer_name,
        u.email AS organizer_email,
        h.track,
        h.location,
        h.start_date AS expected_date,
        h.start_date,
        h.end_date,
        h.registration_deadline,
        h.max_teams,
        h.event_type,
        h.settings,
        h.banner_web_url,
        h.banner_mobile_url,
        h.status,
        h.approval_status,
        h.approval_feedback,
        h.created_at,
        h.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'round_number',r.round_number,
              'title',r.title,
              'start_at',r.start_at,
              'end_at',r.end_at,
              'status',r.status
            )
            ORDER BY r.round_number
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) AS rounds
      FROM hackathons h
      JOIN users u ON u.id = h.organizer_id
      LEFT JOIN hackathon_rounds r
        ON r.hackathon_id = h.id
      WHERE h.approval_status = 'PENDING'
      GROUP BY h.id,u.name,u.email
      ORDER BY h.created_at ASC
      `
    );

    return res.json({
      success: true,
      count: result.rows.length,
      hackathons: result.rows,
    });
  } catch (error) {
    console.error(
      "GET PENDING HACKATHON APPROVALS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch pending approvals",
    });
  }
}

export async function reviewHackathonApproval(req, res) {
  try {
    const { id } = req.params;
    const { decision, feedback } = req.body;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message:
          "Only admins can review hackathon approvals",
      });
    }

    const normalizedDecision = String(decision || "")
      .trim()
      .toUpperCase();

    if (
      !["APPROVE", "REJECT"].includes(normalizedDecision)
    ) {
      return res.status(400).json({
        success: false,
        message: "Decision must be APPROVE or REJECT",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        title,
        organizer_id,
        approval_status,
        publication_status
      FROM hackathons
      WHERE id = $1::uuid
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = result.rows[0];

    if (hackathon.approval_status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Hackathon is not pending approval",
      });
    }

    const approvalStatus =
      normalizedDecision === "APPROVE"
        ? "APPROVED"
        : "REJECTED";

    const cleanFeedback =
      feedback === undefined ||
      feedback === null ||
      String(feedback).trim() === ""
        ? null
        : String(feedback).trim();

    const updated = await pool.query(
      `
      UPDATE hackathons
      SET
        approval_status = $1::varchar,
        approval_feedback = $2::text,

        approved_by = CASE
          WHEN $1::varchar = 'APPROVED'
          THEN $3::uuid
          ELSE NULL
        END,

        approved_at = CASE
          WHEN $1::varchar = 'APPROVED'
          THEN NOW()
          ELSE NULL
        END,

        updated_at = NOW()

      WHERE id = $4::uuid

      RETURNING *
      `,
      [
        approvalStatus,
        cleanFeedback,
        req.user.id,
        id,
      ]
    );

    return res.json({
      success: true,
      message:
        normalizedDecision === "APPROVE"
          ? "Hackathon approved successfully"
          : "Hackathon rejected successfully",
      hackathon: updated.rows[0],
    });
  } catch (error) {
    console.error(
      "REVIEW HACKATHON APPROVAL ERROR:",
      error
    );

    console.error("ERROR CODE:", error.code);
    console.error("ERROR DETAIL:", error.detail);
    console.error("ERROR MESSAGE:", error.message);

    return res.status(500).json({
      success: false,
      message:
        "Unable to review hackathon approval",
    });
  }
}

export async function scheduleHackathonRounds(req, res) {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { rounds } = req.body;

    if (!Array.isArray(rounds) || rounds.length < 1 || rounds.length > 3) {
      return res.status(400).json({
        success: false,
        message: "1 to 3 rounds must be provided",
      });
    }

    const hackathonResult = await client.query(
      `
      SELECT
        id, title, description, organizer_id, track, location,
        start_date, end_date, registration_deadline, max_teams,
        status, approval_status, approval_feedback,
        approved_by, approved_at, publication_status,
        published_at, published_by, current_round, settings,
        created_at, updated_at
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (hackathonResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = hackathonResult.rows[0];

    if (
      req.user.role !== "ADMIN" &&
      hackathon.organizer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only schedule your own hackathons",
      });
    }

    if (hackathon.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message:
          "Completed hackathons cannot have their rounds changed",
      });
    }

    const normalizedRounds = rounds
      .map((round) => ({
        round_number: Number(round.round_number),
        title:
          round.title || `Round ${round.round_number}`,
        start_at: round.start_at || null,
        end_at: round.end_at || null,
        requirement:
          round.requirement && String(round.requirement).trim()
            ? String(round.requirement).trim()
            : null,
        ai_usage_required:
          round.ai_usage_required === true ||
          round.ai_usage_required === "true",
        // v6.44 — tri-state: true/false wins, null/omitted keeps
        // whatever the round already had.
        show_timer:
          round.show_timer === true || round.show_timer === "true"
            ? true
            : round.show_timer === false || round.show_timer === "false"
              ? false
              : null,
        // v6.45 — 'demo' or 'idea'; null/omitted keeps the round's.
        submission_type:
          round.submission_type === "demo"
            ? "demo"
            : round.submission_type === "idea"
              ? "idea"
              : null,
      }))
      .sort((a, b) => a.round_number - b.round_number);

    const expectedNumbers = normalizedRounds.map((_, i) => i + 1);

    for (let i = 0; i < expectedNumbers.length; i++) {
      if (
        normalizedRounds[i]?.round_number !==
        expectedNumbers[i]
      ) {
        return res.status(400).json({
          success: false,
          message: "Round numbers must be 1, 2 and 3 in order",
        });
      }
    }

    for (const round of normalizedRounds) {
      if (
        round.start_at &&
        round.end_at &&
        new Date(round.start_at) >=
          new Date(round.end_at)
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Round ${round.round_number} end time must be after start time`,
        });
      }
    }

    await client.query("BEGIN");

    for (const round of normalizedRounds) {
      await client.query(
        `
        INSERT INTO hackathon_rounds (
          hackathon_id,
          round_number,
          title,
          start_at,
          end_at,
          requirement,
          ai_usage_required,
          status,
          show_timer,
          submission_type
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,'SCHEDULED',$8,$9)
        ON CONFLICT (hackathon_id,round_number)
        DO UPDATE SET
          title = EXCLUDED.title,
          start_at = EXCLUDED.start_at,
          end_at = EXCLUDED.end_at,
          requirement = EXCLUDED.requirement,
          ai_usage_required = EXCLUDED.ai_usage_required,
          show_timer = COALESCE(EXCLUDED.show_timer, hackathon_rounds.show_timer),
          submission_type = COALESCE(EXCLUDED.submission_type, hackathon_rounds.submission_type),
          updated_at = NOW()
        `,
        [
          id,
          round.round_number,
          round.title,
          round.start_at,
          round.end_at,
          round.requirement,
          round.ai_usage_required,
          round.show_timer,
          round.submission_type,
        ]
      );
    }

    // v6.38 — shrinking the round count only removes rounds that
    // were never activated (no submissions can exist for them);
    // rounds that already ran are kept, never deleted.
    await client.query(
      `
      DELETE FROM hackathon_rounds
      WHERE hackathon_id = $1
        AND round_number > $2
        AND status = 'SCHEDULED'
      `,
      [id, normalizedRounds.length]
    );

    const saved = await client.query(
      `
      SELECT
        id,
        hackathon_id,
        round_number,
        title,
        start_at,
        end_at,
        requirement,
        ai_usage_required,
        show_timer,
        submission_type,
        status,
        activated_at,
        activated_by,
        completed_at,
        updated_at
      FROM hackathon_rounds
      WHERE hackathon_id = $1
      ORDER BY round_number
      `,
      [id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message:
        "Hackathon rounds configured successfully",
      rounds: saved.rows,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "SCHEDULE HACKATHON ROUNDS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to save round configuration",
    });
  } finally {
    client.release();
  }
}

export async function getHackathonRounds(req, res) {
  try {
    const { id } = req.params;

    const hackathonResult = await pool.query(
      `
      SELECT
        id,
        title,
        organizer_id,
        status,
        publication_status,
        current_round
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (hackathonResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        hackathon_id,
        round_number,
        title,
        start_at,
        end_at,
        requirement,
        ai_usage_required,
        show_timer,
        submission_type,
        status,
        activated_at,
        activated_by,
        completed_at,
        updated_at
      FROM hackathon_rounds
      WHERE hackathon_id = $1
      ORDER BY round_number ASC
      `,
      [id]
    );

    return res.json({
      success: true,
      hackathon: hackathonResult.rows[0],
      count: result.rows.length,
      rounds: result.rows,
    });
  } catch (error) {
    console.error(
      "GET HACKATHON ROUNDS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch hackathon rounds",
    });
  }
}

export async function activateHackathonRound(req, res) {
  try {
    const { id, roundNumber } = req.params;
    const round = Number(roundNumber);

    if (![1, 2, 3].includes(round)) {
      return res.status(400).json({
        success: false,
        message: "Round number must be 1, 2 or 3",
      });
    }

    const hackathonResult = await pool.query(
      `
      SELECT
        id,
        title,
        organizer_id,
        publication_status,
        status,
        current_round
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (hackathonResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = hackathonResult.rows[0];

    if (
      req.user.role !== "ADMIN" &&
      hackathon.organizer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only manage your own hackathons",
      });
    }

    if (hackathon.publication_status !== "PUBLISHED") {
      return res.status(400).json({
        success: false,
        message: "Hackathon must be published first",
      });
    }

    if (hackathon.status !== "LIVE") {
      return res.status(400).json({
        success: false,
        message:
          "Hackathon must be LIVE before activating a round",
      });
    }

    const roundResult = await pool.query(
      `
      SELECT
        id,
        hackathon_id,
        round_number,
        title,
        start_at,
        end_at,
        status
      FROM hackathon_rounds
      WHERE hackathon_id = $1
        AND round_number = $2
      `,
      [id, round]
    );

    if (roundResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          `Round ${round} has not been configured`,
      });
    }

    const roundData = roundResult.rows[0];

    if (roundData.status === "LIVE") {
      return res.status(400).json({
        success: false,
        message:
          `Round ${round} is already live`,
      });
    }

    if (roundData.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message:
          `Round ${round} is already completed`,
      });
    }

    if (round > 1) {
      const previousRoundResult = await pool.query(
        `
        SELECT status
        FROM hackathon_rounds
        WHERE hackathon_id = $1
          AND round_number = $2
        `,
        [id, round - 1]
      );

      if (previousRoundResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            `Round ${round - 1} must be configured before activating Round ${round}`,
        });
      }

      if (
        previousRoundResult.rows[0].status !==
        "COMPLETED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Round ${round - 1} must be completed before activating Round ${round}`,
        });
      }
    }

    const updated = await pool.query(
      `
      UPDATE hackathon_rounds
      SET
        status = 'LIVE',
        activated_at = NOW(),
        activated_by = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [req.user.id, roundData.id]
    );

    await pool.query(
      `
      UPDATE hackathons
      SET
        current_round = $1,
        status = 'LIVE',
        updated_at = NOW()
      WHERE id = $2
      `,
      [round, id]
    );

    return res.json({
      success: true,
      message:
        `Round ${round} is now live`,
      round: updated.rows[0],
    });
  } catch (error) {
    console.error(
      "ACTIVATE HACKATHON ROUND ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to activate hackathon round",
    });
  }
}

export async function completeHackathonRound(req, res) {
  try {
    const { id, roundNumber } = req.params;
    const round = Number(roundNumber);

    if (![1, 2, 3].includes(round)) {
      return res.status(400).json({
        success: false,
        message:
          "Round number must be 1, 2 or 3",
      });
    }

    const hackathonResult = await pool.query(
      `
      SELECT
        id,
        title,
        organizer_id,
        publication_status,
        status,
        current_round
      FROM hackathons
      WHERE id = $1
      `,
      [id]
    );

    if (hackathonResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = hackathonResult.rows[0];

    if (
      req.user.role !== "ADMIN" &&
      hackathon.organizer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only manage your own hackathons",
      });
    }

    const roundResult = await pool.query(
      `
      SELECT
        id,
        round_number,
        title,
        start_at,
        end_at,
        status
      FROM hackathon_rounds
      WHERE hackathon_id = $1
        AND round_number = $2
      `,
      [id, round]
    );

    if (roundResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          `Round ${round} not found`,
      });
    }

    const roundData = roundResult.rows[0];

    if (roundData.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message:
          `Round ${round} is already completed`,
      });
    }

    if (roundData.status !== "LIVE") {
      return res.status(400).json({
        success: false,
        message:
          `Round ${round} must be LIVE before it can be completed`,
      });
    }

    const updated = await pool.query(
      `
      UPDATE hackathon_rounds
      SET
        status = 'COMPLETED',
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [roundData.id]
    );

    let newHackathonStatus = "LIVE";
    let newCurrentRound = round;

    if (round === 3) {
      newHackathonStatus = "COMPLETED";
      newCurrentRound = 4;
    }

    await pool.query(
      `
      UPDATE hackathons
      SET
        current_round = $1,
        status = $2,
        updated_at = NOW()
      WHERE id = $3
      `,
      [newCurrentRound, newHackathonStatus, id]
    );

    return res.json({
      success: true,
      message:
        `Round ${round} completed successfully`,
      round: updated.rows[0],
      hackathonStatus: newHackathonStatus,
      currentRound: newCurrentRound,
    });
  } catch (error) {
    console.error(
      "COMPLETE HACKATHON ROUND ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to complete hackathon round",
    });
  }
}
/* ============================================================
   v6.38 — INVITE CODES + EVENT SETTINGS
   Invite-code-only events: the organizer generates one code per
   paid email; the student enters it at join time (see
   joinHackathon). Codes are email-tied, so sharing a code does
   not help anyone else.
   ============================================================ */

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeInviteCode() {
  let code = "RB-";
  for (let i = 0; i < 6; i++) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return code;
}

async function ownedHackathonOrNull(id, user) {
  const r = await pool.query(
    `SELECT id, organizer_id FROM hackathons WHERE id = $1`,
    [id]
  );
  if (r.rows.length === 0) return { status: 404, message: "Hackathon not found" };
  if (user.role !== "ADMIN" && r.rows[0].organizer_id !== user.id) {
    return { status: 403, message: "You can only manage your own hackathons" };
  }
  return { hackathon: r.rows[0] };
}

export async function generateInviteCodes(req, res) {
  try {
    const { id } = req.params;
    const chk = await ownedHackathonOrNull(id, req.user);
    if (chk.status) {
      return res.status(chk.status).json({ success: false, message: chk.message });
    }
    const raw = req.body?.emails;
    const list = Array.isArray(raw)
      ? raw
      : String(raw || "").split(/[\n,]+/);
    const emails = [...new Set(
      list.map((e) => String(e || "").trim().toLowerCase()).filter((e) => e.includes("@"))
    )].slice(0, 200);
    if (emails.length === 0) {
      return res.status(400).json({ success: false, message: "No valid emails provided" });
    }
    for (const email of emails) {
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          await pool.query(
            `
            INSERT INTO event_invite_codes (hackathon_id, email, code, created_by)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (hackathon_id, email) DO NOTHING
            `,
            [id, email, makeInviteCode(), req.user.id]
          );
          break;
        } catch (e) {
          // Code collision (same code twice): regenerate and retry.
          if (e.code !== "23505") throw e;
        }
      }
    }
    const all = await pool.query(
      `
      SELECT c.id, c.email, c.code, c.used_by, c.used_at, c.created_at,
             u.name AS used_by_name
      FROM event_invite_codes c
      LEFT JOIN users u ON u.id = c.used_by
      WHERE c.hackathon_id = $1
      ORDER BY c.created_at ASC
      `,
      [id]
    );
    return res.json({ success: true, codes: all.rows });
  } catch (error) {
    console.error("GENERATE INVITE CODES ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to generate invite codes" });
  }
}

export async function listInviteCodes(req, res) {
  try {
    const { id } = req.params;
    const chk = await ownedHackathonOrNull(id, req.user);
    if (chk.status) {
      return res.status(chk.status).json({ success: false, message: chk.message });
    }
    const all = await pool.query(
      `
      SELECT c.id, c.email, c.code, c.used_by, c.used_at, c.created_at,
             u.name AS used_by_name
      FROM event_invite_codes c
      LEFT JOIN users u ON u.id = c.used_by
      WHERE c.hackathon_id = $1
      ORDER BY c.created_at ASC
      `,
      [id]
    );
    return res.json({ success: true, codes: all.rows });
  } catch (error) {
    console.error("LIST INVITE CODES ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to list invite codes" });
  }
}

export async function revokeInviteCode(req, res) {
  try {
    const { id, codeId } = req.params;
    const chk = await ownedHackathonOrNull(id, req.user);
    if (chk.status) {
      return res.status(chk.status).json({ success: false, message: chk.message });
    }
    const found = await pool.query(
      `SELECT used_by FROM event_invite_codes WHERE id = $1 AND hackathon_id = $2`,
      [codeId, id]
    );
    if (found.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Invite code not found" });
    }
    if (found.rows[0].used_by) {
      return res.status(400).json({ success: false, message: "Used codes cannot be revoked" });
    }
    await pool.query(
      `DELETE FROM event_invite_codes WHERE id = $1 AND hackathon_id = $2`,
      [codeId, id]
    );
    return res.json({ success: true, message: "Invite code revoked" });
  } catch (error) {
    console.error("REVOKE INVITE CODE ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to revoke invite code" });
  }
}

export async function updateHackathonSettings(req, res) {
  try {
    const { id } = req.params;
    const chk = await ownedHackathonOrNull(id, req.user);
    if (chk.status) {
      return res.status(chk.status).json({ success: false, message: chk.message });
    }
    const showTimer = req.body?.show_timer === undefined ? null : !!req.body.show_timer;
    const inviteOnly = req.body?.invite_only === undefined ? null : !!req.body.invite_only;
    if (showTimer === null && inviteOnly === null) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }
    const updated = await pool.query(
      `
      UPDATE hackathons
      SET show_timer = COALESCE($2, show_timer),
          invite_only = COALESCE($3, invite_only),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, show_timer, invite_only
      `,
      [id, showTimer, inviteOnly]
    );
    return res.json({ success: true, hackathon: updated.rows[0] });
  } catch (error) {
    console.error("UPDATE HACKATHON SETTINGS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to update settings" });
  }
}
