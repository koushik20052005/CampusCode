/* =========================================================
   otp.service.js — email OTP generation, storage, verification.

   - 6-digit OTP, SHA-256 hashed at rest, 5-minute expiry
   - Max 5 verification attempts per OTP
   - MASTER OTP fallback: env vars MASTER_OTP_1 / MASTER_OTP_2
     (8-digit codes). If the mail system is down, a master OTP
     always verifies — usage is flagged used_master=TRUE for audit.
     Keep these secret; rotate them periodically.
   ========================================================= */

import crypto from "crypto";
import pool from "../config/db.js";

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;

const MASTER_OTPS = [process.env.MASTER_OTP_1, process.env.MASTER_OTP_2]
  .filter(Boolean)
  .map(String);

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

function newOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function isMasterOtp(otp) {
  return MASTER_OTPS.includes(String(otp).trim());
}

/* Create + store a fresh OTP for an email/purpose. Invalidates older ones. */
export async function createOtp(email, purpose = "register") {
  const clean = String(email).trim().toLowerCase();
  const otp = newOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await pool.query(
    `UPDATE email_otps SET used_at = NOW()
     WHERE email = $1 AND purpose = $2 AND used_at IS NULL`,
    [clean, purpose]
  );

  await pool.query(
    `INSERT INTO email_otps (email, otp_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [clean, hashOtp(otp), purpose, expiresAt]
  );

  // housekeeping: drop expired rows now and then
  pool
    .query(`DELETE FROM email_otps WHERE expires_at < NOW() - INTERVAL '1 hour'`)
    .catch(() => {});

  return { otp, expiresAt };
}

/* Verify an OTP. Returns { ok, reason?, master? }. */
export async function verifyOtp(email, otp, purpose = "register") {
  const clean = String(email).trim().toLowerCase();
  const code = String(otp).trim();

  // Master OTP bypass — works even when mail is down. Audit-flagged.
  if (isMasterOtp(code)) {
    await pool.query(
      `INSERT INTO email_otps (email, otp_hash, purpose, expires_at, used_at, used_master)
       VALUES ($1, 'master', $2, NOW(), NOW(), TRUE)`,
      [clean, purpose]
    ).catch(() => {});
    console.log(`[otp] master OTP used for ${clean} (${purpose})`);
    return { ok: true, master: true };
  }

  const { rows } = await pool.query(
    `SELECT * FROM email_otps
     WHERE email = $1 AND purpose = $2 AND used_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [clean, purpose]
  );
  const record = rows[0];
  if (!record) return { ok: false, reason: "No OTP was sent to this email. Request a new one." };
  if (new Date(record.expires_at) < new Date())
    return { ok: false, reason: "OTP expired. Request a new one." };
  if (record.attempts >= MAX_ATTEMPTS)
    return { ok: false, reason: "Too many attempts. Request a new one." };

  await pool.query(`UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1`, [
    record.id,
  ]);

  // timing-safe compare
  const a = Buffer.from(hashOtp(code));
  const b = Buffer.from(record.otp_hash);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!match) return { ok: false, reason: "Incorrect OTP. Try again." };

  await pool.query(`UPDATE email_otps SET used_at = NOW() WHERE id = $1`, [record.id]);
  return { ok: true };
}

/* Has this email completed OTP verification for a purpose (recently)? */
export async function hasVerified(email, purpose = "register", withinMinutes = 30) {
  const { rows } = await pool.query(
    `SELECT 1 FROM email_otps
     WHERE email = $1 AND purpose = $2 AND used_at IS NOT NULL
       AND used_at > NOW() - ($3 || ' minutes')::interval
     LIMIT 1`,
    [String(email).trim().toLowerCase(), purpose, String(withinMinutes)]
  );
  return rows.length > 0;
}
