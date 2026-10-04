import pool from "../config/db.js";

/*
|--------------------------------------------------------------------------
| HELPER
|--------------------------------------------------------------------------
*/

function canManageHackathon(req, hackathon) {
  if (!req.user) {
    return false;
  }

  if (req.user.role === "ADMIN") {
    return true;
  }

  if (
    req.user.role === "ORGANIZER" &&
    hackathon.organizer_id === req.user.id
  ) {
    return true;
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| GET ROUND LIFECYCLE
|--------------------------------------------------------------------------
|
| GET /api/hackathons/:hackathonId/round-lifecycle
|
*/

export async function getRoundLifecycle(req, res) {
  try {
    const { hackathonId } = req.params;

    const hackathonResult = await pool.query(
      `
      SELECT
        id,
        title,
        organizer_id,
        status,
        approval_status,
        publication_status,
        current_round,
        start_date,
        end_date,
        created_at,
        updated_at
      FROM hackathons
      WHERE id = $1
      `,
      [hackathonId]
    );

    if (hackathonResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon = hackathonResult.rows[0];

    const roundsResult = await pool.query(
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
        completed_at,
        updated_at
      FROM hackathon_rounds
      WHERE hackathon_id = $1
      ORDER BY round_number ASC
      `,
      [hackathonId]
    );

    const rounds = roundsResult.rows;

    const round1 =
      rounds.find((r) => Number(r.round_number) === 1) || null;

    const round2 =
      rounds.find((r) => Number(r.round_number) === 2) || null;

    const round3 =
      rounds.find((r) => Number(r.round_number) === 3) || null;

    return res.json({
      success: true,

      hackathon,

      rounds,

      lifecycle: {
        hackathon_status: hackathon.status,
        current_round: hackathon.current_round,

        round1: {
          status: round1?.status || "SCHEDULED",
          active: round1?.status === "LIVE",
          completed: round1?.status === "COMPLETED",
        },

        round2: {
          status: round2?.status || "SCHEDULED",
          active: round2?.status === "LIVE",
          completed: round2?.status === "COMPLETED",

          locked:
            !round1 ||
            round1.status !== "COMPLETED",
        },

        round3: {
          status: round3?.status || "SCHEDULED",
          active: round3?.status === "LIVE",
          completed: round3?.status === "COMPLETED",

          locked:
            !round2 ||
            round2.status !== "COMPLETED",
        },
      },
    });
  } catch (error) {
    console.error(
      "GET ROUND LIFECYCLE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch round lifecycle",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}

/*
|--------------------------------------------------------------------------
| ACTIVATE ROUND
|--------------------------------------------------------------------------
|
| POST /api/hackathons/:hackathonId/rounds/:roundNumber/lifecycle/activate
|
| IMPORTANT:
| Expected dates are informational only.
| We DO NOT check start_at/end_at against current time.
|
*/

export async function activateRound(req, res) {
  const client = await pool.connect();

  try {
    const {
      hackathonId,
      roundNumber,
    } = req.params;

    const round = Number(roundNumber);

    if (![1, 2, 3].includes(round)) {
      return res.status(400).json({
        success: false,
        message: "Round number must be 1, 2 or 3",
      });
    }

    await client.query("BEGIN");

    /*
    |--------------------------------------------------------------------------
    | LOCK HACKATHON
    |--------------------------------------------------------------------------
    */

    const hackathonResult = await client.query(
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

    /*
    |--------------------------------------------------------------------------
    | AUTHORIZATION
    |--------------------------------------------------------------------------
    */

    if (!canManageHackathon(req, hackathon)) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message:
          "You can only manage your own hackathons",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | PUBLISHED CHECK
    |--------------------------------------------------------------------------
    */

    if (
      hackathon.publication_status !==
      "PUBLISHED"
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "Hackathon must be published before activating a round",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | HACKATHON MUST BE LIVE
    |--------------------------------------------------------------------------
    */

    if (hackathon.status !== "LIVE") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "Hackathon must be LIVE before activating a round",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | GET ROUND
    |--------------------------------------------------------------------------
    */

    const roundResult = await client.query(
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
        completed_at,
        updated_at
      FROM hackathon_rounds
      WHERE hackathon_id = $1
        AND round_number = $2
      FOR UPDATE
      `,
      [hackathonId, round]
    );

    if (roundResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message:
          `Round ${round} has not been configured`,
      });
    }

    const roundData = roundResult.rows[0];

    /*
    |--------------------------------------------------------------------------
    | ALREADY LIVE
    |--------------------------------------------------------------------------
    */

    if (roundData.status === "LIVE") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          `Round ${round} is already LIVE`,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ALREADY COMPLETED
    |--------------------------------------------------------------------------
    */

    if (roundData.status === "COMPLETED") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          `Round ${round} is already COMPLETED`,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ROUND 2 LOCK
    |--------------------------------------------------------------------------
    |
    | Round 1 MUST be completed.
    |
    */

    if (round === 2) {
      const previousRoundResult =
        await client.query(
          `
          SELECT
            id,
            status
          FROM hackathon_rounds
          WHERE hackathon_id = $1
            AND round_number = 1
          FOR UPDATE
          `,
          [hackathonId]
        );

      if (
        previousRoundResult.rows.length === 0
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "Round 1 must be configured before activating Round 2",
        });
      }

      const round1 =
        previousRoundResult.rows[0];

      if (round1.status !== "COMPLETED") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "Round 2 is locked. Round 1 must be completed before activating Round 2.",
          locked: true,
          previous_round: 1,
          previous_round_status:
            round1.status,
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | ROUND 3 LOCK
    |--------------------------------------------------------------------------
    |
    | Round 2 MUST be completed.
    |
    */

    if (round === 3) {
      const previousRoundResult =
        await client.query(
          `
          SELECT
            id,
            status
          FROM hackathon_rounds
          WHERE hackathon_id = $1
            AND round_number = 2
          FOR UPDATE
          `,
          [hackathonId]
        );

      if (
        previousRoundResult.rows.length === 0
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "Round 2 must be configured before activating Round 3",
        });
      }

      const round2 =
        previousRoundResult.rows[0];

      if (round2.status !== "COMPLETED") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "Round 3 is locked. Round 2 must be completed before activating Round 3.",
          locked: true,
          previous_round: 2,
          previous_round_status:
            round2.status,
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | MAKE SURE ONLY ONE ROUND IS LIVE
    |--------------------------------------------------------------------------
    */

    await client.query(
      `
      UPDATE hackathon_rounds
      SET
        status = 'SCHEDULED',
        updated_at = NOW()
      WHERE hackathon_id = $1
        AND round_number <> $2
        AND status = 'LIVE'
      `,
      [hackathonId, round]
    );

    /*
    |--------------------------------------------------------------------------
    | ACTIVATE ROUND
    |--------------------------------------------------------------------------
    |
    | NO CALENDAR CHECK HERE.
    |
    */

    const updatedResult =
      await client.query(
        `
        UPDATE hackathon_rounds
        SET
          status = 'LIVE',
          activated_at = NOW(),
          activated_by = $1,
          completed_at = NULL,
          updated_at = NOW()
        WHERE id = $2
        RETURNING
          id,
          hackathon_id,
          round_number,
          title,
          start_at,
          end_at,
          status,
          activated_at,
          activated_by,
          completed_at,
          updated_at
        `,
        [
          req.user.id,
          roundData.id,
        ]
      );

    /*
    |--------------------------------------------------------------------------
    | UPDATE HACKATHON
    |--------------------------------------------------------------------------
    */

    await client.query(
      `
      UPDATE hackathons
      SET
        current_round = $1,
        status = 'LIVE',
        updated_at = NOW()
      WHERE id = $2
      `,
      [round, hackathonId]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message:
        `Round ${round} is now LIVE`,
      round:
        updatedResult.rows[0],
      current_round: round,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "ACTIVATE ROUND LIFECYCLE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to activate round",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  } finally {
    client.release();
  }
}

/*
|--------------------------------------------------------------------------
| COMPLETE ROUND
|--------------------------------------------------------------------------
|
| POST /api/hackathons/:hackathonId/rounds/:roundNumber/lifecycle/complete
|
*/

export async function completeRound(req, res) {
  const client = await pool.connect();

  try {
    const {
      hackathonId,
      roundNumber,
    } = req.params;

    const round = Number(roundNumber);

    if (![1, 2, 3].includes(round)) {
      return res.status(400).json({
        success: false,
        message:
          "Round number must be 1, 2 or 3",
      });
    }

    await client.query("BEGIN");

    /*
    |--------------------------------------------------------------------------
    | GET HACKATHON
    |--------------------------------------------------------------------------
    */

    const hackathonResult =
      await client.query(
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
        FOR UPDATE
        `,
        [hackathonId]
      );

    if (
      hackathonResult.rows.length === 0
    ) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message:
          "Hackathon not found",
      });
    }

    const hackathon =
      hackathonResult.rows[0];

    /*
    |--------------------------------------------------------------------------
    | AUTHORIZATION
    |--------------------------------------------------------------------------
    */

    if (
      !canManageHackathon(
        req,
        hackathon
      )
    ) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message:
          "You can only manage your own hackathons",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | GET ROUND
    |--------------------------------------------------------------------------
    */

    const roundResult =
      await client.query(
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
          completed_at,
          updated_at
        FROM hackathon_rounds
        WHERE hackathon_id = $1
          AND round_number = $2
        FOR UPDATE
        `,
        [hackathonId, round]
      );

    if (
      roundResult.rows.length === 0
    ) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message:
          `Round ${round} not found`,
      });
    }

    const roundData =
      roundResult.rows[0];

    /*
    |--------------------------------------------------------------------------
    | MUST BE LIVE
    |--------------------------------------------------------------------------
    */

    if (roundData.status !== "LIVE") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          `Round ${round} must be LIVE before it can be completed`,
        current_status:
          roundData.status,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | COMPLETE ROUND
    |--------------------------------------------------------------------------
    */

    const updatedResult =
      await client.query(
        `
        UPDATE hackathon_rounds
        SET
          status = 'COMPLETED',
          completed_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          hackathon_id,
          round_number,
          title,
          start_at,
          end_at,
          status,
          activated_at,
          activated_by,
          completed_at,
          updated_at
        `,
        [roundData.id]
      );

    /*
    |--------------------------------------------------------------------------
    | ROUND 3 COMPLETED
    |--------------------------------------------------------------------------
    |
    | Hackathon is now COMPLETED.
    |
    */

    if (round === 3) {
      await client.query(
        `
        UPDATE hackathons
        SET
          status = 'COMPLETED',
          current_round = 3,
          updated_at = NOW()
        WHERE id = $1
        `,
        [hackathonId]
      );
    } else {
      /*
      |--------------------------------------------------------------------------
      | Keep hackathon LIVE
      |--------------------------------------------------------------------------
      |
      | Next round stays SCHEDULED until manually activated.
      |
      */

      await client.query(
        `
        UPDATE hackathons
        SET
          status = 'LIVE',
          current_round = $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [round, hackathonId]
      );
    }

    await client.query("COMMIT");

    return res.json({
      success: true,

      message:
        `Round ${round} completed successfully`,

      round:
        updatedResult.rows[0],

      hackathon: {
        status:
          round === 3
            ? "COMPLETED"
            : "LIVE",

        current_round:
          round,
      },

      next_round:
        round < 3
          ? {
              round_number:
                round + 1,
              status:
                "SCHEDULED",
              locked: true,
              unlock_condition:
                `Round ${round} must be COMPLETED`,
            }
          : null,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "COMPLETE ROUND LIFECYCLE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to complete round",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  } finally {
    client.release();
  }
}

/*
|--------------------------------------------------------------------------
| REOPEN ROUND
|--------------------------------------------------------------------------
|
| Mainly useful for development/testing.
|
| POST /api/hackathons/:hackathonId/rounds/:roundNumber/lifecycle/reopen
|
*/

export async function reopenRound(req, res) {
  const client = await pool.connect();

  try {
    const {
      hackathonId,
      roundNumber,
    } = req.params;

    const round = Number(roundNumber);

    if (![1, 2, 3].includes(round)) {
      return res.status(400).json({
        success: false,
        message:
          "Round number must be 1, 2 or 3",
      });
    }

    await client.query("BEGIN");

    const hackathonResult =
      await client.query(
        `
        SELECT
          id,
          organizer_id,
          status,
          publication_status,
          current_round
        FROM hackathons
        WHERE id = $1
        FOR UPDATE
        `,
        [hackathonId]
      );

    if (
      hackathonResult.rows.length === 0
    ) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message:
          "Hackathon not found",
      });
    }

    const hackathon =
      hackathonResult.rows[0];

    if (
      !canManageHackathon(
        req,
        hackathon
      )
    ) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message:
          "You can only manage your own hackathons",
      });
    }

    const roundResult =
      await client.query(
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
        FOR UPDATE
        `,
        [hackathonId, round]
      );

    if (
      roundResult.rows.length === 0
    ) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message:
          `Round ${round} not found`,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | REOPEN AS SCHEDULED
    |--------------------------------------------------------------------------
    */

    const updated =
      await client.query(
        `
        UPDATE hackathon_rounds
        SET
          status = 'SCHEDULED',
          completed_at = NULL,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [roundResult.rows[0].id]
      );

    await client.query(
      `
      UPDATE hackathons
      SET
        status = 'LIVE',
        current_round = $1,
        updated_at = NOW()
      WHERE id = $2
      `,
      [round, hackathonId]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message:
        `Round ${round} reopened`,
      round:
        updated.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "REOPEN ROUND ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to reopen round",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  } finally {
    client.release();
  }
}