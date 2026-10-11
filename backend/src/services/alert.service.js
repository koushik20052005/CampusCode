/* =========================================================
   alert.service.js — v6.15 self-monitoring with email alerts.
   Runs inside the backend on a timer (no external service).

   Every CHECK_INTERVAL_MIN it verifies:
     1. Database is reachable
     2. Error rate hasn't spiked (from monitoring telemetry)

   On failure it emails ALERT_EMAIL via the existing mail
   service. Cooldown prevents alert spam: one email per
   ALERT_COOLDOWN_MIN per alert type.

   Env:
     ALERT_EMAIL        where alerts go (e.g. your real email)
     ALERT_CHECK_MIN    default 5
     ALERT_COOLDOWN_MIN default 30
     ERROR_SPIKE_THRESHOLD default 20 errors / 5 min
   ========================================================= */

import pool from "../config/db.js";
import { sendMail, isMailConfigured } from "./mail.service.js";

const CHECK_MIN = Number(process.env.ALERT_CHECK_MIN || 5);
const COOLDOWN_MIN = Number(process.env.ALERT_COOLDOWN_MIN || 30);
const ERROR_THRESHOLD = Number(process.env.ERROR_SPIKE_THRESHOLD || 20);
const ALERT_EMAIL = process.env.ALERT_EMAIL || "";

// last alert timestamps per type (in-memory; resets on redeploy — fine)
const lastAlert = { db_down: 0, error_spike: 0 };

function cooldownOk(type) {
  return Date.now() - (lastAlert[type] || 0) > COOLDOWN_MIN * 60 * 1000;
}
function markAlerted(type) {
  lastAlert[type] = Date.now();
}

async function sendAlert(subject, html) {
  if (!ALERT_EMAIL || !isMailConfigured()) return;
  await sendMail({ to: ALERT_EMAIL, subject, html });
}

async function checkDatabase() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function recentErrorCount() {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM monitoring_logs
       WHERE status_code >= 500
         AND created_at > NOW() - ($1 || ' minutes')::INTERVAL`,
      [String(CHECK_MIN)]
    );
    return rows[0]?.c || 0;
  } catch {
    return 0;
  }
}

export async function runHealthCheck() {
  if (!ALERT_EMAIL) return; // alerts not configured — skip silently

  // 1. database
  const dbOk = await checkDatabase();
  if (!dbOk && cooldownOk("db_down")) {
    markAlerted("db_down");
    await sendAlert(
      "🚨 CampusCode ALERT: database unreachable",
      `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#dc2626">Database unreachable</h2>
        <p>The CampusCode backend could not reach PostgreSQL at ${new Date().toISOString()}.</p>
        <p>Check Render logs and the database status page.</p>
      </div>`
    );
  }

  // 2. error spike
  const errors = await recentErrorCount();
  if (errors >= ERROR_THRESHOLD && cooldownOk("error_spike")) {
    markAlerted("error_spike");
    await sendAlert(
      `🚨 CampusCode ALERT: ${errors} errors in ${CHECK_MIN} min`,
      `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#dc2626">Error spike detected</h2>
        <p><b>${errors}</b> errors logged in the last ${CHECK_MIN} minutes (threshold: ${ERROR_THRESHOLD}).</p>
        <p>Open Admin → Monitoring → Errors to investigate.</p>
      </div>`
    );
  }
}

export function startAlertMonitor() {
  if (!ALERT_EMAIL) {
    console.log("[alerts] ALERT_EMAIL not set — self-monitoring alerts disabled.");
    return;
  }
  console.log(
    `[alerts] self-monitoring on: check every ${CHECK_MIN} min, cooldown ${COOLDOWN_MIN} min → ${ALERT_EMAIL}`
  );
  // stagger first run so boot isn't slowed
  setTimeout(runHealthCheck, 60 * 1000);
  setInterval(runHealthCheck, CHECK_MIN * 60 * 1000);
}
