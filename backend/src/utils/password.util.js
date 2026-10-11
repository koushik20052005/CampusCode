/* =========================================================
   password.util.js — shared password strength rules.
   Used by register and reset-password (backend enforced,
   frontend mirrors for instant feedback).
   ========================================================= */

export const PASSWORD_RULES = {
  minLength: 8,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSpecial: false,
};

export function checkPasswordStrength(password) {
  const pw = String(password || "");
  const errors = [];
  if (pw.length < PASSWORD_RULES.minLength)
    errors.push(`at least ${PASSWORD_RULES.minLength} characters`);
  if (PASSWORD_RULES.requireUpper && !/[A-Z]/.test(pw))
    errors.push("one uppercase letter");
  if (PASSWORD_RULES.requireLower && !/[a-z]/.test(pw))
    errors.push("one lowercase letter");
  if (PASSWORD_RULES.requireDigit && !/[0-9]/.test(pw))
    errors.push("one number");
  if (PASSWORD_RULES.requireSpecial && !/[^A-Za-z0-9]/.test(pw))
    errors.push("one special character");
  return {
    ok: errors.length === 0,
    errors,
    message: errors.length
      ? `Password needs ${errors.join(", ")}.`
      : "Password looks good.",
  };
}
