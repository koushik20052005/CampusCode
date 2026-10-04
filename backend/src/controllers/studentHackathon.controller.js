import pool from "../config/db.js";

/* =========================================================
   STUDENT HACKATHON CONTROLLER
   CampusCode - Phase 2

   Student flow:

   Browse Hackathons
        ↓
   Register
        ↓
   My Registrations
        ↓
   Round Status
========================================================= */


/* =========================================================
   GET AVAILABLE HACKATHONS

   Shows only published/open hackathons that students
   can currently register for.
========================================================= */

export async function getAvailableHackathons(req, res) {
  try {
    const studentId = req.user.id;

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
        h.registration_deadline,
        h.status,
        h.publication_status,
        h.current_round,

        EXISTS (
          SELECT 1
          FROM hackathon_participants hp
          WHERE hp.hackathon_id = h.id
            AND hp.user_id = $1
        ) AS is_registered

      FROM hackathons h

      WHERE h.publication_status = 'PUBLISHED'
        AND h.status = 'OPEN'

      ORDER BY h.start_date ASC NULLS LAST
      `,
      [studentId]
    );

    return res.status(200).json({
      success: true,
      total_hackathons: result.rows.length,
      hackathons: result.rows,
    });
  } catch (error) {
    console.error(
      "GET AVAILABLE HACKATHONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch available hackathons",
    });
  }
}


/* =========================================================
   REGISTER FOR HACKATHON

   Student registration happens here.

   Important:
   - Must be published
   - Must be open
   - Registration deadline cannot be passed
   - Duplicate registration prevented
========================================================= */

export async function registerForHackathon(req, res) {
  const client = await pool.connect();

  try {
    const studentId = req.user.id;
    const { hackathonId } = req.params;

    await client.query("BEGIN");

    const hackathonResult = await client.query(
      `
      SELECT
        id,
        title,
        status,
        publication_status,
        registration_deadline
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

    /* -------------------------------------------------------
       Published check
    ------------------------------------------------------- */

    if (hackathon.publication_status !== "PUBLISHED") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "This hackathon is not published yet",
      });
    }

    /* -------------------------------------------------------
       Open check
    ------------------------------------------------------- */

    if (hackathon.status !== "OPEN") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "Registration is currently closed for this hackathon",
      });
    }

    /* -------------------------------------------------------
       Registration deadline
    ------------------------------------------------------- */

    if (hackathon.registration_deadline) {
      const now = new Date();

      const deadline = new Date(
        hackathon.registration_deadline
      );

      if (now > deadline) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "Registration deadline has passed",
        });
      }
    }

    /* -------------------------------------------------------
       Duplicate registration check
    ------------------------------------------------------- */

    const existingRegistration =
      await client.query(
        `
        SELECT
          id,
          status
        FROM hackathon_participants
        WHERE hackathon_id = $1
          AND user_id = $2
        `,
        [hackathonId, studentId]
      );

    if (existingRegistration.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message:
          "You are already registered for this hackathon",
        registration:
          existingRegistration.rows[0],
      });
    }

    /* -------------------------------------------------------
       Create registration
    ------------------------------------------------------- */

    const registrationResult =
      await client.query(
        `
        INSERT INTO hackathon_participants (
          hackathon_id,
          user_id,
          status
        )
        VALUES (
          $1,
          $2,
          'REGISTERED'
        )
        RETURNING
          id,
          hackathon_id,
          user_id,
          status
        `,
        [hackathonId, studentId]
      );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message:
        "Successfully registered for the hackathon",
      registration:
        registrationResult.rows[0],
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failure
    }

    console.error(
      "REGISTER FOR HACKATHON ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to register for hackathon",
    });
  } finally {
    client.release();
  }
}


/* =========================================================
   GET MY HACKATHONS

   Returns every hackathon registered by the logged-in
   student.

   IMPORTANT FIX:
   The previous implementation directly joined:

   hackathon_participants
          ↓
   team_members
          ↓
   teams
          ↓
   projects

   That could create multiple rows for the same hackathon.

   This version uses LATERAL queries and LIMIT 1 so the
   student receives exactly ONE record per hackathon.

   Also returns:
   - team
   - project
   - round schedule
   - round availability
========================================================= */

export async function getMyHackathons(req, res) {
  try {
    const studentId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        hp.id AS participant_id,
        hp.hackathon_id,
        hp.user_id,
        hp.status AS registration_status,

        h.title AS hackathon_title,
        h.description AS hackathon_description,
        h.track,
        h.location,
        h.start_date,
        h.end_date,
        h.registration_deadline,
        h.status AS hackathon_status,
        h.publication_status,
        h.current_round,

        team_data.team_id,
        team_data.team_name,
        team_data.team_status,

        project_data.project_id,
        project_data.project_title

      FROM hackathon_participants hp

      JOIN hackathons h
        ON h.id = hp.hackathon_id

      LEFT JOIN LATERAL (
        SELECT
          t.id AS team_id,
          t.name AS team_name,
          t.status AS team_status
        FROM team_members tm
        JOIN teams t
          ON t.id = tm.team_id
        WHERE tm.user_id = hp.user_id
          AND t.hackathon_id = hp.hackathon_id
        ORDER BY t.id
        LIMIT 1
      ) team_data ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          p.id AS project_id,
          p.title AS project_title
        FROM projects p
        WHERE p.team_id = team_data.team_id
        ORDER BY p.id
        LIMIT 1
      ) project_data ON TRUE

      WHERE hp.user_id = $1

      ORDER BY
        h.start_date DESC NULLS LAST,
        hp.hackathon_id
      `,
      [studentId]
    );

    /* -------------------------------------------------------
       Get unique hackathon IDs
    ------------------------------------------------------- */

    const hackathonIds = [
      ...new Set(
        result.rows
          .map((row) => row.hackathon_id)
          .filter(Boolean)
      ),
    ];

    /* -------------------------------------------------------
       Get rounds
    ------------------------------------------------------- */

    let rounds = [];

    if (hackathonIds.length > 0) {
      const roundResult = await pool.query(
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
          completed_at

        FROM hackathon_rounds

        WHERE hackathon_id = ANY($1::uuid[])

        ORDER BY
          hackathon_id,
          round_number
        `,
        [hackathonIds]
      );

      rounds = roundResult.rows;
    }

    /* -------------------------------------------------------
       Group rounds by hackathon
    ------------------------------------------------------- */

    const roundsByHackathon = new Map();

    for (const round of rounds) {
      const key = String(round.hackathon_id);

      if (!roundsByHackathon.has(key)) {
        roundsByHackathon.set(key, []);
      }

      roundsByHackathon.get(key).push(round);
    }

    /* -------------------------------------------------------
       Format response
    ------------------------------------------------------- */

    const now = new Date();

    const seen = new Set();
    const hackathons = [];

    for (const row of result.rows) {
      const hackathonId = String(row.hackathon_id);

      if (!hackathonId || seen.has(hackathonId)) {
        continue;
      }

      seen.add(hackathonId);

      const hackathonRounds =
        roundsByHackathon.get(hackathonId) || [];

      /* -----------------------------------------------------
         Current round name
      ----------------------------------------------------- */

      let roundName = "Round 1";

      if (Number(row.current_round) === 2) {
        roundName = "Round 2";
      } else if (Number(row.current_round) === 3) {
        roundName = "Round 3";
      } else if (Number(row.current_round) === 4) {
        roundName = "Completed";
      }

      /* -----------------------------------------------------
         Format rounds
      ----------------------------------------------------- */

      const formattedRounds = [1, 2, 3].map(
        (roundNumber) => {
          const round =
            hackathonRounds.find(
              (item) =>
                Number(item.round_number) ===
                roundNumber
            );

          if (!round) {
            return {
              round_number: roundNumber,
              title: `Round ${roundNumber}`,
              status: "NOT_SCHEDULED",
              locked: true,
              can_access: false,
            };
          }

          const status = String(
            round.status || ""
          ).toUpperCase();

          const isLive =
            status === "LIVE";

          const isCompleted =
            status === "COMPLETED";

          const hasStarted =
            round.start_at
              ? now >= new Date(round.start_at)
              : false;

          return {
            id: round.id,

            round_number:
              Number(round.round_number),

            title:
              round.title ||
              `Round ${roundNumber}`,

            start_at:
              round.start_at,

            end_at:
              round.end_at,

            status:
              round.status,

            activated_at:
              round.activated_at,

            completed_at:
              round.completed_at,

            locked:
              !isLive && !isCompleted,

            can_access:
              isLive,

            scheduled:
              hasStarted &&
              !isLive &&
              !isCompleted,

            label:
              isCompleted
                ? "Completed"
                : isLive
                ? "Live"
                : "Locked",
          };
        }
      );

      /* -----------------------------------------------------
         Final hackathon object
      ----------------------------------------------------- */

      hackathons.push({
        participant_id:
          row.participant_id,

        hackathon_id:
          row.hackathon_id,

        registration_status:
          row.registration_status,

        hackathon: {
          id:
            row.hackathon_id,

          title:
            row.hackathon_title,

          description:
            row.hackathon_description,

          track:
            row.track,

          location:
            row.location,

          start_date:
            row.start_date,

          end_date:
            row.end_date,

          registration_deadline:
            row.registration_deadline,

          status:
            row.hackathon_status,

          publication_status:
            row.publication_status,

          current_round:
            Number(row.current_round || 0),

          current_round_name:
            roundName,

          completed:
            Number(row.current_round || 0) === 4,
        },

        team: row.team_id
          ? {
              id:
                row.team_id,

              name:
                row.team_name,

              status:
                row.team_status,
            }
          : null,

        project: row.project_id
          ? {
              id:
                row.project_id,

              title:
                row.project_title,
            }
          : null,

        rounds:
          formattedRounds,
      });
    }

    return res.status(200).json({
      success: true,

      message:
        "My hackathons fetched successfully",

      total_hackathons:
        hackathons.length,

      hackathons,
    });
  } catch (error) {
    console.error(
      "GET MY HACKATHONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch my hackathons",
    });
  }
}


/* =========================================================
   GET SINGLE REGISTERED HACKATHON

   Useful when student clicks a hackathon from
   "My Registrations".
========================================================= */

export async function getMyHackathonById(
  req,
  res
) {
  try {
    const studentId = req.user.id;
    const { hackathonId } = req.params;

    const result = await pool.query(
      `
      SELECT
        hp.id AS participant_id,
        hp.status AS registration_status,

        h.id,
        h.title,
        h.description,
        h.track,
        h.location,
        h.start_date,
        h.end_date,
        h.registration_deadline,
        h.status,
        h.publication_status,
        h.current_round

      FROM hackathon_participants hp

      JOIN hackathons h
        ON h.id = hp.hackathon_id

      WHERE hp.hackathon_id = $1
        AND hp.user_id = $2
      `,
      [hackathonId, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "You are not registered for this hackathon",
      });
    }

    const hackathon =
      result.rows[0];

    const rounds = await pool.query(
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
        completed_at

      FROM hackathon_rounds

      WHERE hackathon_id = $1

      ORDER BY round_number
      `,
      [hackathonId]
    );

    const now = new Date();

    const formattedRounds =
      [1, 2, 3].map(
        (roundNumber) => {
          const round =
            rounds.rows.find(
              (item) =>
                Number(
                  item.round_number
                ) === roundNumber
            );

          if (!round) {
            return {
              round_number:
                roundNumber,

              title:
                `Round ${roundNumber}`,

              status:
                "NOT_SCHEDULED",

              locked: true,

              can_access: false,
            };
          }

          const status =
            String(
              round.status || ""
            ).toUpperCase();

          const live =
            status === "LIVE";

          const completed =
            status === "COMPLETED";

          return {
            id:
              round.id,

            round_number:
              Number(
                round.round_number
              ),

            title:
              round.title ||
              `Round ${roundNumber}`,

            start_at:
              round.start_at,

            end_at:
              round.end_at,

            status:
              round.status,

            activated_at:
              round.activated_at,

            completed_at:
              round.completed_at,

            locked:
              !live &&
              !completed,

            can_access:
              live,

            started:
              round.start_at
                ? now >=
                  new Date(
                    round.start_at
                  )
                : false,

            label:
              completed
                ? "Completed"
                : live
                ? "Live"
                : "Locked",
          };
        }
      );

    return res.status(200).json({
      success: true,

      registration: {
        participant_id:
          hackathon.participant_id,

        status:
          hackathon.registration_status,
      },

      hackathon: {
        id:
          hackathon.id,

        title:
          hackathon.title,

        description:
          hackathon.description,

        track:
          hackathon.track,

        location:
          hackathon.location,

        start_date:
          hackathon.start_date,

        end_date:
          hackathon.end_date,

        registration_deadline:
          hackathon.registration_deadline,

        status:
          hackathon.status,

        publication_status:
          hackathon.publication_status,

        current_round:
          hackathon.current_round,
      },

      rounds:
        formattedRounds,
    });
  } catch (error) {
    console.error(
      "GET MY HACKATHON BY ID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch hackathon",
    });
  }
}