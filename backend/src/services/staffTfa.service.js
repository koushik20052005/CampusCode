/* =========================================================
   staffTfa.service.js — 8-digit static 2FA keys for staff
   (ADMIN / ORGANIZER / SUB_ADMIN), managed by admin.

   - Keys are 8 digits, numbers only (easy to read out / type).
   - Stored as SHA-256 hash — plaintext shown ONCE at creation.
   - Verified with timing-safe compare; attempts are rate-limited
     by the login endpoint's limiter + account lockout.
   ========================================================= */

import crypto from "crypto";
import pool from "../config/db.js";

export function generateTfaKey() {
  let key = "";
  for (let i = 0; i < 8; i++) key += crypto.randomInt(0, 10);
  // avoid keys starting with 0 (leading-zero confusion when read aloud)
  if (key[0] === "0") key = String(crypto.randomInt(1, 10)) + key.slice(1);
  return key;
}

export function hashTfaKey(key) {
  return crypto.createHash("sha256").update(String(key).trim()).digest("hex");
}

export function verifyTfaKey(input, storedHash) {
  if (!input || !storedHash) return false;
  const clean = String(input).trim().replace(/\D/g, "");
  if (clean.length !== 8) return false;
  const a = Buffer.from(hashTfaKey(clean));
  const b = Buffer.from(storedHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function setStaffTfaKey(userId, key) {
  await pool.query(`UPDATE users SET tfa_key_hash = $1 WHERE id = $2`, [
    hashTfaKey(key),
    userId,
  ]);
}

export async function clearStaffTfaKey(userId) {
  await pool.query(`UPDATE users SET tfa_key_hash = NULL WHERE id = $1`, [userId]);
}

export async function getStaffTfaStatus(userId) {
  const { rows } = await pool.query(
    `SELECT tfa_key_hash IS NOT NULL AS has_key FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0]?.has_key ?? false;
}
