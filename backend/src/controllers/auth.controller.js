import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { hasVerified } from "../services/otp.service.js";
import { createCaptcha, verifyCaptcha } from "../services/captcha.service.js";
import { checkPasswordStrength } from "../utils/password.util.js";
import { createOtp } from "../services/otp.service.js";
import { sendMail, otpEmailTemplate, isMailConfigured } from "../services/mail.service.js";

/* =========================================================
   CREATE JWT
========================================================= */

const createToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      // Configurable lifetime; defaults to 1 day.
      // Set JWT_EXPIRES_IN=7d in .env if longer sessions are needed.
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );
};


/* =========================================================
   CAMPUSCODE ID
   Every user gets a unique public ID (e.g. CC-8K2N4P)
   used for the Digital ID card QR code.
========================================================= */

const generateCampusCodeId = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `CC-${suffix}`;
};


/* =========================================================
   REGISTER
========================================================= */

export const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = "STUDENT",
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const pwCheck = checkPasswordStrength(password);
    if (!pwCheck.ok) {
      return res.status(400).json({
        success: false,
        message: pwCheck.message,
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    /*
      v6.6 — STUDENT-ONLY public registration.
      Organizer accounts are created by admins; anyone asking
      for ORGANIZER here is pointed to campuscode@gmail.com.
      SUB_ADMIN is intentionally NOT allowed either.
    */

    if (role === "ORGANIZER") {
      return res.status(403).json({
        success: false,
        message:
          "Organizer accounts are created by our team. Please contact campuscode@gmail.com",
      });
    }

    const allowedRoles = ["STUDENT"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid registration role",
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    /*
      v6.10 — email must be verified before the account is created.
      The frontend sends a 6-digit OTP and calls /auth/verify-otp first;
      this guard stops anyone skipping the UI and posting here directly.
      Master OTPs count as verified (they're audit-logged in email_otps).
    */
    const verified = await hasVerified(normalizedEmail, "register", 30);
    if (!verified) {
      return res.status(403).json({
        success: false,
        message:
          "Please verify your email with the OTP code before creating your account.",
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      INSERT INTO users
      (name, email, password_hash, role, campus_code_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        name,
        email,
        role,
        campus_code_id,
        is_active,
        created_at
      `,
      [
        name.trim(),
        normalizedEmail,
        passwordHash,
        role,
        generateCampusCodeId(),
      ]
    );

    const user = result.rows[0];

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user,
    });

  } catch (error) {

    console.error(
      "Registration error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to create account",
    });
  }
};


/* =========================================================
   GET CURRENT USER
========================================================= */

export async function getMe(req, res) {
  try {

    return res.status(200).json({
      success: true,
      user: req.user,
    });

  } catch (error) {

    console.error(
      "GET ME ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch user",
    });
  }
}


/* =========================================================
   LOGIN
========================================================= */

export const login = async (req, res) => {

  try {

    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {

      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        password_hash,
        role,
        is_active
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {

      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {

      return res.status(403).json({
        success: false,
        message:
          "Your account has been blocked",
      });
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!passwordMatches) {

      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    /*
      SUB_ADMIN is a valid authenticated role.

      Sub-admin accounts are created by an ADMIN
      and cannot be created through public registration.
    */

    const validRoles = [
      "STUDENT",
      "ORGANIZER",
      "ADMIN",
      "SUB_ADMIN",
    ];

    if (!validRoles.includes(user.role)) {

      return res.status(403).json({
        success: false,
        message:
          "Your account has an invalid role",
      });
    }

    /*
      v6.11.3 — students must complete OTP verification before login.
      Admin/organizer accounts use internal emails (no real inbox),
      so they log in with password + captcha only. This backend guard
      stops anyone bypassing the frontend OTP step via direct API call.
    */
    if (user.role === "STUDENT") {
      const otpOk = await hasVerified(normalizedEmail, "login", 30);
      if (!otpOk) {
        return res.status(403).json({
          success: false,
          message: "Please verify the login code sent to your email.",
        });
      }
    }

    const token =
      createToken(user);

    return res.json({
      success: true,
      message: "Login successful",
      token,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
      },
    });

  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error.message
    );

    console.error(
      "Code:",
      error.code
    );

    console.error(
      "Detail:",
      error.detail
    );

    return res.status(500).json({
      success: false,
      message: "Unable to login",
    });
  }
};

/* =========================================================
   v6.10 — PRE-LOGIN credential check (no token issued).
   Used by the login OTP step: verifies email+password are
   correct BEFORE sending the OTP, so OTP emails can't be
   triggered for arbitrary addresses.
   ========================================================= */
export const preLogin = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }
    // v6.11.1 — captcha lives on send-otp (the actual email-sending step),
    // not here: pre-login is rate-limited and needs the correct password anyway.
    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await pool.query(
      `SELECT id, password_hash, is_active, role FROM users WHERE email = $1`,
      [normalizedEmail]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: "Your account has been blocked" });
    }
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    // v6.11.3 — OTP only for students (admin/organizer emails aren't real inboxes)
    const requiresOtp = user.role === "STUDENT";
    return res.status(200).json({ success: true, message: "Credentials valid.", requiresOtp, role: user.role });
  } catch (err) {
    console.error("[auth] pre-login error:", err.message);
    return res.status(500).json({ success: false, message: "Unable to verify credentials." });
  }
};
/* =========================================================
   v6.11 — CAPTCHA + forgot/reset password (all free).
   ========================================================= */

/* GET /api/auth/captcha → { captchaId, svg } */
export const getCaptcha = async (req, res) => {
  try {
    const c = await createCaptcha();
    return res.status(200).json({ success: true, ...c });
  } catch (err) {
    console.error("[auth] captcha error:", err.message);
    return res.status(500).json({ success: false, message: "Could not load captcha." });
  }
};

/* POST /api/auth/forgot-password { email } → sends reset OTP */
export const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address." });
    }
    // v6.11 — captcha blocks bots from spamming reset emails
    const captchaOk = await verifyCaptcha(req.body?.captchaId, req.body?.captchaText);
    if (!captchaOk) {
      return res.status(400).json({
        success: false,
        message: "Captcha did not match. Try again.",
        captchaFailed: true,
      });
    }
    // Don't reveal whether the email exists
    const { rows } = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: "If this email is registered, a reset code was sent.",
        delivered: false,
      });
    }
    const { otp } = await createOtp(email, "reset");
    const result = await sendMail({
      to: email,
      subject: `Your CampusCode password reset code is ${otp}`,
      html: otpEmailTemplate(otp, "reset"),
    });
    const devMode = !isMailConfigured() && process.env.NODE_ENV !== "production";
    return res.status(200).json({
      success: true,
      message: result.sent
        ? "Reset code sent to your email. It expires in 5 minutes."
        : "Could not send email right now. Try again later.",
      delivered: result.sent,
      ...(devMode ? { dev_otp: otp } : {}),
    });
  } catch (err) {
    console.error("[auth] forgot-password error:", err.message);
    return res.status(500).json({ success: false, message: "Try again later." });
  }
};

/* POST /api/auth/reset-password { email, otp, newPassword } */
export const resetPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const otp = String(req.body?.otp || "").trim();
    const newPassword = String(req.body?.newPassword || "");
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "Email, code and new password are required." });
    }
    const pwCheck = checkPasswordStrength(newPassword);
    if (!pwCheck.ok) {
      return res.status(400).json({ success: false, message: pwCheck.message });
    }
    const { verifyOtp } = await import("../services/otp.service.js");
    const v = await verifyOtp(email, otp, "reset");
    if (!v.ok) {
      return res.status(400).json({ success: false, message: v.reason });
    }
    const hash = await bcrypt.hash(newPassword, 12);
    const { rowCount } = await pool.query(
      `UPDATE users SET password_hash = $1 WHERE email = $2`,
      [hash, email]
    );
    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }
    return res.status(200).json({ success: true, message: "Password reset. You can log in now." });
  } catch (err) {
    console.error("[auth] reset-password error:", err.message);
    return res.status(500).json({ success: false, message: "Try again later." });
  }
};
