/* =========================================================
   CERTIFICATES CONTROLLER — Module 8
   Participation: every member of a team with a SUBMITTED
   Round 1 submission (auto-submitted proposals count).
   Winners: organizer picks up to 3 teams + places 1/2/3.
   QUIZ EVENTS (v6.26): participation goes to every student
   with a SUBMITTED quiz attempt; winners are students picked
   by user_id + place (no teams exist for quizzes, team_id
   stays NULL and the PDF team line is omitted).
   All issues are idempotent — re-running never duplicates
   (UNIQUE on hackathon_id + user_id + type).
   FirstCommit/Unstop manual-name issue is NOT in v1: the
   organizer picker is finalized later, per Koushik 2026-10-26.
========================================================= */

import pool from "../config/db.js";

import {
  CERT_THEMES,
  formatCertDate,
  generateUniqueCodes,
  renderCertificatePdf,
} from "../services/certificate.service.js";


/* Load a hackathon and enforce organizer ownership (ADMIN bypass). */
async function loadOwnedHackathon(req, res, hackathonId) {
  const result = await pool.query(
    `
    SELECT
      id,
      title,
      track,
      start_date,
      end_date,
      organizer_id,
      event_type

    FROM hackathons

    WHERE id = $1

    LIMIT 1
    `,
    [hackathonId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({
      success: false,
      message: "Hackathon not found",
    });
    return null;
  }

  const hackathon = result.rows[0];
  const isAdmin = req.user?.role === "ADMIN";

  if (!isAdmin && String(hackathon.organizer_id) !== String(req.user.id)) {
    res.status(403).json({
      success: false,
      message: "You can only manage your own hackathons",
    });
    return null;
  }

  return hackathon;
}

function validTheme(theme) {
  return CERT_THEMES.includes(theme) ? theme : "sidebar";
}

/* Best-effort bulk notifications (never break issuance). */
async function notifyUsers(client, userIds, title, message) {
  if (userIds.length === 0) return;
  try {
    const values = [];
    const placeholders = [];
    userIds.forEach((userId, i) => {
      const base = i * 3;
      placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
      values.push(userId, title, message);
    });
    await client.query(
      `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES ${placeholders.join(", ")}
      `,
      values
    );
  } catch (notifyError) {
    console.error(
      "CERTIFICATE NOTIFY FAILED:",
      notifyError?.message || notifyError
    );
  }
}


/* =========================================================
   PUBLIC VERIFICATION — no auth (QR scanners may be guests)
   GET /api/certificates/verify/:code
========================================================= */

export async function verifyCertificate(req, res) {
  try {
    const { code } = req.params;

    const result = await pool.query(
      `
      SELECT
        c.id,
        c.code,
        c.type,
        c.place,
        c.theme,
        c.issued_at,
        u.name AS holder_name,
        h.title AS hackathon_title

      FROM certificates c

      INNER JOIN users u
        ON u.id = c.user_id

      INNER JOIN hackathons h
        ON h.id = c.hackathon_id

      WHERE c.code = $1

      LIMIT 1
      `,
      [String(code || "").trim().toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: "Certificate not found",
      });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      certificate: result.rows[0],
    });
  } catch (error) {
    console.error("VERIFY CERTIFICATE ERROR:", error);
    return res.status(500).json({
      success: false,
      valid: false,
      message: "Failed to verify certificate",
    });
  }
}


/* =========================================================
   STUDENT'S OWN CERTIFICATES
   GET /api/certificates/mine
========================================================= */

export async function listMyCertificates(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        c.id,
        c.hackathon_id,
        h.title AS hackathon_title,
        c.team_id,
        t.name AS team_name,
        c.type,
        c.place,
        c.theme,
        c.code,
        c.issued_at

      FROM certificates c

      INNER JOIN hackathons h
        ON h.id = c.hackathon_id

      LEFT JOIN teams t
        ON t.id = c.team_id

      WHERE c.user_id = $1

      ORDER BY c.issued_at DESC
      `,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      certificates: result.rows,
    });
  } catch (error) {
    console.error("LIST MY CERTIFICATES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load certificates",
    });
  }
}


/* =========================================================
   ORGANIZER: LIST ISSUED CERTIFICATES FOR A HACKATHON
   GET /api/certificates/hackathons/:hackathonId
========================================================= */

export async function listHackathonCertificates(req, res) {
  try {
    const hackathon = await loadOwnedHackathon(req, res, req.params.hackathonId);
    if (!hackathon) return;

    const result = await pool.query(
      `
      SELECT
        c.id,
        c.user_id,
        u.name AS holder_name,
        c.team_id,
        t.name AS team_name,
        c.type,
        c.place,
        c.theme,
        c.code,
        c.issued_at

      FROM certificates c

      INNER JOIN users u
        ON u.id = c.user_id

      LEFT JOIN teams t
        ON t.id = c.team_id

      WHERE c.hackathon_id = $1

      ORDER BY c.issued_at DESC

      LIMIT 1000
      `,
      [hackathon.id]
    );

    return res.status(200).json({
      success: true,
      hackathon: { id: hackathon.id, title: hackathon.title },
      certificates: result.rows,
    });
  } catch (error) {
    console.error("LIST HACKATHON CERTIFICATES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load certificates",
    });
  }
}


/* =========================================================
   ORGANIZER: ISSUE PARTICIPATION CERTIFICATES
   POST /api/certificates/hackathons/:hackathonId/issue-participation
   Body: { theme }
========================================================= */

export async function issueParticipation(req, res) {
  const client = await pool.connect();
  try {
    const hackathon = await loadOwnedHackathon(req, res, req.params.hackathonId);
    if (!hackathon) return;

    const theme = validTheme(req.body?.theme);

    /* Quiz events have no teams and no Round 1: eligibility is
       every student with a SUBMITTED attempt for this quiz. */
    const eligible =
      hackathon.event_type === "quiz"
        ? await client.query(
            `
            SELECT DISTINCT
              NULL::uuid AS team_id,
              user_id

            FROM quiz_attempts

            WHERE hackathon_id = $1
              AND status = 'SUBMITTED'
            `,
            [hackathon.id]
          )
        : await client.query(
            `
      SELECT DISTINCT
        t.id AS team_id,
        tm.user_id AS user_id

      FROM teams t

      INNER JOIN team_members tm
        ON tm.team_id = t.id

      INNER JOIN round1_submissions r1
        ON r1.team_id = t.id
        AND r1.status = 'SUBMITTED'

      WHERE t.hackathon_id = $1
      `,
            [hackathon.id]
          );

    const rows = eligible.rows;
    const codes = await generateUniqueCodes(pool, rows.length);

    await client.query("BEGIN");
    const insertedUserIds = [];
    for (let i = 0; i < rows.length; i++) {
      const inserted = await client.query(
        `
        INSERT INTO certificates (
          hackathon_id, team_id, user_id, type, theme, code
        )
        VALUES ($1, $2, $3, 'PARTICIPATION', $4, $5)
        ON CONFLICT (hackathon_id, user_id, type) DO NOTHING
        RETURNING id
        `,
        [hackathon.id, rows[i].team_id, rows[i].user_id, theme, codes[i]]
      );
      if (inserted.rows.length > 0) insertedUserIds.push(rows[i].user_id);
    }
    await notifyUsers(
      client,
      insertedUserIds,
      "Your participation certificate is ready",
      `Your certificate for "${hackathon.title}" is ready to download.`
    );
    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Participation certificates issued",
      eligible: rows.length,
      issued: insertedUserIds.length,
      already_had: rows.length - insertedUserIds.length,
      theme,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error("ISSUE PARTICIPATION ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to issue participation certificates",
    });
  } finally {
    client.release();
  }
}


/* =========================================================
   ORGANIZER: ISSUE WINNER CERTIFICATES
   POST /api/certificates/hackathons/:hackathonId/issue-winners
   Body: { theme, winners: [{ team_id, place }] }
========================================================= */

export async function issueWinners(req, res) {
  const client = await pool.connect();
  try {
    const hackathon = await loadOwnedHackathon(req, res, req.params.hackathonId);
    if (!hackathon) return;

    const theme = validTheme(req.body?.theme);
    const winners = Array.isArray(req.body?.winners) ? req.body.winners : [];

    if (winners.length === 0 || winners.length > 3) {
      return res.status(400).json({
        success: false,
        message: "Provide 1 to 3 winners",
      });
    }

    const places = winners.map((w) => Number(w.place));
    const placeSet = new Set(places);
    if (
      placeSet.size !== places.length ||
      places.some((p) => ![1, 2, 3].includes(p))
    ) {
      return res.status(400).json({
        success: false,
        message: "Places must be unique values from 1, 2, 3",
      });
    }

    /* Quiz branch: winners are individual students (user_id),
       each must hold a SUBMITTED attempt for this quiz. */
    if (hackathon.event_type === "quiz") {
      const userIds = winners.map((w) => w.user_id);
      if (userIds.some((id) => !id)) {
        return res.status(400).json({
          success: false,
          message: "Each winner needs a student",
        });
      }
      if (new Set(userIds.map(String)).size !== userIds.length) {
        return res.status(400).json({
          success: false,
          message: "Each winner must be a different student",
        });
      }
      const owned = await client.query(
        `
        SELECT user_id FROM quiz_attempts
        WHERE hackathon_id = $1
          AND user_id = ANY($2)
          AND status = 'SUBMITTED'
        `,
        [hackathon.id, userIds]
      );
      if (owned.rows.length !== userIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more students did not submit this quiz",
        });
      }

      await client.query("BEGIN");
      const insertedUserIds = [];
      for (const winner of winners) {
        const codes = await generateUniqueCodes(pool, 1);
        const inserted = await client.query(
          `
          INSERT INTO certificates (
            hackathon_id, team_id, user_id, type, place, theme, code
          )
          VALUES ($1, NULL, $2, 'WINNER', $3, $4, $5)
          ON CONFLICT (hackathon_id, user_id, type) DO NOTHING
          RETURNING id
          `,
          [hackathon.id, winner.user_id, winner.place, theme, codes[0]]
        );
        if (inserted.rows.length > 0) insertedUserIds.push(winner.user_id);
      }
      await notifyUsers(
        client,
        insertedUserIds,
        "Your winner certificate is ready",
        `Your winner certificate for "${hackathon.title}" is ready to download.`
      );
      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Winner certificates issued",
        issued: insertedUserIds.length,
        theme,
      });
    }

    const teamIds = winners.map((w) => w.team_id);
    const owned = await client.query(
      `
      SELECT id FROM teams
      WHERE hackathon_id = $1 AND id = ANY($2)
      `,
      [hackathon.id, teamIds]
    );
    if (owned.rows.length !== teamIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more teams do not belong to this hackathon",
      });
    }

    await client.query("BEGIN");
    const insertedUserIds = [];
    for (const winner of winners) {
      const members = await client.query(
        `
        SELECT user_id FROM team_members WHERE team_id = $1
        `,
        [winner.team_id]
      );
      const codes = await generateUniqueCodes(pool, members.rows.length);
      for (let i = 0; i < members.rows.length; i++) {
        const inserted = await client.query(
          `
          INSERT INTO certificates (
            hackathon_id, team_id, user_id, type, place, theme, code
          )
          VALUES ($1, $2, $3, 'WINNER', $4, $5, $6)
          ON CONFLICT (hackathon_id, user_id, type) DO NOTHING
          RETURNING id
          `,
          [
            hackathon.id,
            winner.team_id,
            members.rows[i].user_id,
            winner.place,
            theme,
            codes[i],
          ]
        );
        if (inserted.rows.length > 0) {
          insertedUserIds.push(members.rows[i].user_id);
        }
      }
    }
    await notifyUsers(
      client,
      insertedUserIds,
      "Your winner certificate is ready",
      `Your winner certificate for "${hackathon.title}" is ready to download.`
    );
    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Winner certificates issued",
      issued: insertedUserIds.length,
      theme,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error("ISSUE WINNERS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to issue winner certificates",
    });
  } finally {
    client.release();
  }
}


/* =========================================================
   DOWNLOAD PDF — owner, or the hackathon's organizer, or ADMIN
   GET /api/certificates/:id/download
========================================================= */

export async function downloadCertificate(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        c.id,
        c.code,
        c.type,
        c.place,
        c.theme,
        c.issued_at,
        c.user_id,
        u.name AS holder_name,
        h.id AS hackathon_id,
        h.title AS hackathon_title,
        h.track,
        h.start_date,
        h.end_date,
        h.organizer_id,
        t.name AS team_name

      FROM certificates c

      INNER JOIN users u
        ON u.id = c.user_id

      INNER JOIN hackathons h
        ON h.id = c.hackathon_id

      LEFT JOIN teams t
        ON t.id = c.team_id

      WHERE c.id = $1

      LIMIT 1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found",
      });
    }

    const cert = result.rows[0];
    const isOwner = String(cert.user_id) === String(req.user.id);
    const isOrganizer =
      String(cert.organizer_id) === String(req.user.id);
    const isAdmin = req.user?.role === "ADMIN";

    if (!isOwner && !isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You cannot download this certificate",
      });
    }

    const pdf = await renderCertificatePdf({
      holderName: cert.holder_name,
      college: cert.track,
      hackathonTitle: cert.hackathon_title,
      teamName: cert.team_name || null,
      track: cert.track,
      eventDate: formatCertDate(cert.end_date || cert.start_date || cert.issued_at),
      code: cert.code,
      type: cert.type,
      place: cert.place,
      theme: cert.theme,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="CampusCode-Certificate-${cert.code}.pdf"`
    );
    return res.send(pdf);
  } catch (error) {
    console.error("DOWNLOAD CERTIFICATE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate certificate PDF",
    });
  }
}
