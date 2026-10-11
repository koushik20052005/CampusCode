/* =========================================================
   captcha.service.js — free server-side CAPTCHA (svg-captcha).
   No external service, no signup, no API keys.

   GET /api/auth/captcha → { captchaId, svg }
   Client renders the SVG and submits captchaId + captchaText
   with login / send-otp. Single-use, 5-minute expiry.
   ========================================================= */

import crypto from "crypto";
import svgCaptcha from "svg-captcha";
import pool from "../config/db.js";

const TTL_MINUTES = 5;

function hashAnswer(text) {
  return crypto.createHash("sha256").update(String(text).trim().toLowerCase()).digest("hex");
}

export async function createCaptcha() {
  // v6.11.1 — numbers only: no confusing letters, easy to read
  const c = svgCaptcha.create({
    size: 5,
    charPreset: "0123456789",
    noise: 2,
    color: true,
    background: "#f4f4f0",
    width: 150,
    height: 50,
  });
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  const { rows } = await pool.query(
    `INSERT INTO captchas (answer_hash, expires_at) VALUES ($1, $2) RETURNING id`,
    [hashAnswer(c.text), expiresAt]
  );
  pool
    .query(`DELETE FROM captchas WHERE expires_at < NOW() - INTERVAL '1 hour'`)
    .catch(() => {});
  return { captchaId: rows[0].id, svg: c.data };
}

/* Returns true only once per captchaId (single-use). */
export async function verifyCaptcha(captchaId, captchaText) {
  if (!captchaId || !captchaText) return false;
  const { rows } = await pool.query(
    `SELECT * FROM captchas WHERE id = $1 AND used_at IS NULL`,
    [captchaId]
  );
  const rec = rows[0];
  if (!rec) return false;
  if (new Date(rec.expires_at) < new Date()) return false;

  const a = Buffer.from(hashAnswer(captchaText));
  const b = Buffer.from(rec.answer_hash);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  await pool.query(`UPDATE captchas SET used_at = NOW() WHERE id = $1`, [rec.id]);
  return match;
}
