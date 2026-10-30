import jwt from "jsonwebtoken";
import pool from "../config/db.js";

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const result = await pool.query(
      `SELECT
        id,
        name,
        email,
        role,
        campus_code_id,
        avatar_url,
        bio,
        skills,
        is_active
       FROM users
       WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    // v6.30 — ADMIN single session: the JWT must carry the current
    // token_version. A newer admin login bumps the version, so any
    // older token is rejected with a session-ended flag (the frontend
    // clears the token and sends the user back to /login). Tokens
    // minted before this feature (no tv claim) are rejected too, so
    // the admin logs in once after the deploy and single-session
    // holds from then on. Non-admin roles skip this check entirely.
    if (user.role === "ADMIN") {
      try {
        const versionResult = await pool.query(
          `SELECT token_version FROM users WHERE id = $1`,
          [user.id]
        );
        const current = versionResult.rows[0]?.token_version;
        if (decoded.tv === undefined || decoded.tv !== current) {
          return res.status(401).json({
            success: false,
            message: "Your session ended because this account was logged in on another device.",
            sessionEnded: true,
          });
        }
      } catch (versionError) {
        // Column not migrated yet: feature not active, allow the
        // request (it starts enforcing itself once 022 has run).
        if (versionError.code !== "42703") throw versionError;
      }
    }

    req.user = user;

    next();
  } catch (error) {
    console.error(
      "AUTH MIDDLEWARE ERROR:",
      error.message
    );

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
    }

    next();
  };
}