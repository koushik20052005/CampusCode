import pool from "../config/db.js";

/* =========================================================
   GET MY DIGITAL ID / PROFILE
========================================================= */

export async function getMyProfile(req, res) {
  try {
    const result = await pool.query(
      `SELECT
        id,
        campus_code_id,
        name,
        email,
        role,
        bio,
        skills,
        avatar_url,
        is_active,
        created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      profile: result.rows[0],
    });
  } catch (error) {
    console.error(
      "GET MY PROFILE ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
}

/* =========================================================
   GET PUBLIC PROFILE BY CAMPUS CODE
========================================================= */

export async function getPublicProfile(req, res) {
  try {
    const { campusCodeId } = req.params;

    if (!campusCodeId) {
      return res.status(400).json({
        success: false,
        message: "CampusCode ID is required",
      });
    }

    const result = await pool.query(
      `SELECT
        campus_code_id,
        name,
        email,
        role,
        bio,
        skills,
        avatar_url,
        is_active,
        created_at
       FROM users
       WHERE campus_code_id = $1`,
      [campusCodeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "CampusCode ID not found",
      });
    }

    return res.json({
      success: true,
      profile: result.rows[0],
    });
  } catch (error) {
    console.error(
      "GET PUBLIC PROFILE ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch public profile",
    });
  }
}

/* =========================================================
   UPDATE MY PROFILE
========================================================= */

export async function updateMyProfile(req, res) {
  try {
    const {
      name,
      bio,
      skills,
      avatar_url,
    } = req.body;

    if (
      name === undefined &&
      bio === undefined &&
      skills === undefined &&
      avatar_url === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "No profile fields provided",
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET
        name = COALESCE($1, name),
        bio = COALESCE($2, bio),
        skills = COALESCE($3, skills),
        avatar_url = COALESCE($4, avatar_url),
        updated_at = NOW()
       WHERE id = $5
       RETURNING
        id,
        campus_code_id,
        name,
        email,
        role,
        bio,
        skills,
        avatar_url,
        is_active,
        created_at,
        updated_at`,
      [
        name ?? null,
        bio ?? null,
        skills ?? null,
        avatar_url ?? null,
        req.user.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      message: "Profile updated successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error(
      "UPDATE PROFILE ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
}

/* =========================================================
   ADMIN — GET ALL USERS
========================================================= */

export async function getAllUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT
        id,
        campus_code_id,
        name,
        email,
        role,
        bio,
        skills,
        avatar_url,
        is_active,
        created_at,
        updated_at
       FROM users
       ORDER BY created_at DESC`
    );

    return res.json({
      success: true,
      users: result.rows,
    });
  } catch (error) {
    console.error(
      "ADMIN GET USERS ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
}