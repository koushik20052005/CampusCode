import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

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
      expiresIn: "7d",
    }
  );
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

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    /*
      IMPORTANT:
      SUB_ADMIN is intentionally NOT allowed
      through public registration.
    */

    const allowedRoles = [
      "STUDENT",
      "ORGANIZER",
    ];

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

    const passwordHash =
      await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      INSERT INTO users
      (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        name,
        email,
        role,
        is_active,
        created_at
      `,
      [
        name.trim(),
        normalizedEmail,
        passwordHash,
        role,
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