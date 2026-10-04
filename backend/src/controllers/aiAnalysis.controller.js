/* =========================================================
   AI ANALYSIS STATUS

   GET /api/analysis/status/:hackathonId

   - STUDENT: job statuses for their own team
     (PENDING / PROCESSING / COMPLETED / FAILED)
   - ORGANIZER / ADMIN / SUB_ADMIN: all jobs in the hackathon
========================================================= */

import pool from "../config/db.js";
import { getTeamJobStatus } from "../services/aiAnalysis.worker.js";

export async function getAnalysisStatus(req, res) {
  try {
    const { hackathonId } = req.params;
    const { id: userId, role } = req.user;

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message: "Hackathon ID is required",
      });
    }

    // Organizers / admins see the whole hackathon queue
    if (["ORGANIZER", "ADMIN", "SUB_ADMIN"].includes(role)) {
      const result = await pool.query(
        `
        SELECT
          j.round, j.status, j.attempts, j.max_attempts,
          j.error, j.updated_at, j.created_at,
          t.name AS team_name
        FROM ai_analysis_jobs j
        INNER JOIN teams t ON t.id = j.team_id
        WHERE j.hackathon_id = $1
        ORDER BY j.round ASC, j.created_at ASC
        `,
        [hackathonId]
      );
      return res.json({ success: true, jobs: result.rows });
    }

    // Students see only their own team's jobs
    const teamResult = await pool.query(
      `
      SELECT t.id AS team_id
      FROM teams t
      INNER JOIN team_members tm ON tm.team_id = t.id
      WHERE t.hackathon_id = $1 AND tm.user_id = $2
      LIMIT 1
      `,
      [hackathonId, userId]
    );

    if (teamResult.rows.length === 0) {
      return res.json({ success: true, jobs: [] });
    }

    const jobs = await getTeamJobStatus(
      hackathonId,
      teamResult.rows[0].team_id
    );

    return res.json({ success: true, jobs });
  } catch (error) {
    console.error("ANALYSIS STATUS ERROR:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch analysis status",
    });
  }
}
