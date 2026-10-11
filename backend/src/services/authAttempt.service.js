/* =========================================================
   authAttempt.service.js — brute-force protection.
   Tracks failed password attempts per account; locks the
   account for LOCKOUT_MINUTES after MAX_ATTEMPTS failures.
   Free, no external service.
   ========================================================= */

import pool from "../config/db.js";

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

/* Returns { locked: true, retryAfterSec } or { locked: false } */
export async function checkLockout(email) {
  const { rows } = await pool.query(
    `SELECT locked_until FROM users WHERE email = $1`,
    [email]
  );
  const u = rows[0];
  if (u?.locked_until && new Date(u.locked_until) > new Date()) {
    const sec = Math.ceil((new Date(u.locked_until) - new Date()) / 1000);
    return { locked: true, retryAfterSec: sec };
  }
  return { locked: false };
}

export function lockoutMessage(retryAfterSec) {
  const mins = Math.ceil(retryAfterSec / 60);
  return `Too many wrong attempts. Account locked — try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}

/* Call on every wrong password. Returns true if this failure triggered a lockout. */
export async function recordFailedAttempt(email) {
  const { rows } = await pool.query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE
           WHEN failed_login_attempts + 1 >= $2
           THEN NOW() + ($3 || ' minutes')::INTERVAL
           ELSE locked_until
         END
     WHERE email = $1
     RETURNING failed_login_attempts, locked_until`,
    [email, MAX_ATTEMPTS, String(LOCKOUT_MINUTES)]
  );
  const r = rows[0];
  return Boolean(r?.locked_until && new Date(r.locked_until) > new Date());
}

/* Call on successful login — clears the counter and any lockout. */
export async function resetAttempts(email) {
  await pool.query(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = $1`,
    [email]
  );
}
