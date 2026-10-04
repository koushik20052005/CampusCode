import pool from "../config/db.js";

/*
  GET STUDENT PROFILE

  GET /api/student/profile
*/
export const getStudentProfile = async (req, res) => {
  try {
    const studentId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        role,
        avatar_url,
        bio,
        skills,
        is_active,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
        AND role = 'STUDENT'
      `,
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student profile fetched successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Get Student Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student profile",
      error: error.message,
    });
  }
};


/*
  UPDATE STUDENT PROFILE

  PUT /api/student/profile

  Allowed fields:
  - name
  - avatar_url
  - bio
  - skills
*/
export const updateStudentProfile = async (req, res) => {
  try {
    const studentId = req.user.id;

    const {
      name,
      avatar_url,
      bio,
      skills,
    } = req.body;

    // --------------------------------------------------
    // Validate name if provided
    // --------------------------------------------------
    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }
    }

    // --------------------------------------------------
    // Validate skills if provided
    // --------------------------------------------------
    if (
      skills !== undefined &&
      !Array.isArray(skills)
    ) {
      return res.status(400).json({
        success: false,
        message: "Skills must be an array",
      });
    }

    // --------------------------------------------------
    // Update only student-editable fields
    // --------------------------------------------------
    const result = await pool.query(
      `
      UPDATE users
      SET
        name = COALESCE($1, name),
        avatar_url = COALESCE($2, avatar_url),
        bio = COALESCE($3, bio),
        skills = COALESCE($4, skills),
        updated_at = NOW()
      WHERE id = $5
        AND role = 'STUDENT'
      RETURNING
        id,
        name,
        email,
        role,
        avatar_url,
        bio,
        skills,
        is_active,
        created_at,
        updated_at
      `,
      [
        name !== undefined ? name.trim() : null,
        avatar_url !== undefined ? avatar_url : null,
        bio !== undefined ? bio : null,
        skills !== undefined ? skills : null,
        studentId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student profile updated successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Update Student Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update student profile",
      error: error.message,
    });
  }
};