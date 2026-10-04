import pool from "../config/db.js";

/*
  ============================================================
  GET STUDENT DIGITAL ID
  ============================================================

  GET /api/student/digital-id

  Authentication:
  - Required
  - STUDENT only
*/
export const getStudentDigitalId = async (req, res) => {
  try {
    const studentId = req.user.id;

    // --------------------------------------------------
    // 1. Get student profile
    // --------------------------------------------------
    const studentResult = await pool.query(
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
        campus_code_id,
        created_at
      FROM users
      WHERE id = $1
        AND role = 'STUDENT'
      `,
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student = studentResult.rows[0];

    // --------------------------------------------------
    // 2. Get number of registered hackathons
    // --------------------------------------------------
    const hackathonResult = await pool.query(
      `
      SELECT COUNT(*) AS total_hackathons
      FROM hackathon_participants
      WHERE user_id = $1
      `,
      [studentId]
    );

    // --------------------------------------------------
    // 3. Get number of teams
    // --------------------------------------------------
    const teamResult = await pool.query(
      `
      SELECT COUNT(DISTINCT tm.team_id) AS total_teams
      FROM team_members tm
      INNER JOIN teams t
        ON t.id = tm.team_id
      WHERE tm.user_id = $1
      `,
      [studentId]
    );

    // --------------------------------------------------
    // 4. Get completed hackathons
    // --------------------------------------------------
    const completedResult = await pool.query(
      `
      SELECT COUNT(*) AS completed_hackathons
      FROM hackathon_participants hp
      INNER JOIN hackathons h
        ON h.id = hp.hackathon_id
      WHERE hp.user_id = $1
        AND h.status = 'COMPLETED'
      `,
      [studentId]
    );

    // --------------------------------------------------
    // 5. Digital ID response
    // --------------------------------------------------
    return res.status(200).json({
      success: true,
      message: "Digital ID fetched successfully",

      digital_id: {
        student: {
          id: student.id,
          name: student.name,
          email: student.email,
          role: student.role,
          avatar_url: student.avatar_url,
          bio: student.bio,
          skills: student.skills,
          is_active: student.is_active,
          campus_code_id: student.campus_code_id,
          joined_at: student.created_at,
        },

        statistics: {
          total_hackathons: Number(
            hackathonResult.rows[0].total_hackathons
          ),

          total_teams: Number(
            teamResult.rows[0].total_teams
          ),

          completed_hackathons: Number(
            completedResult.rows[0].completed_hackathons
          ),
        },

        verification: {
          verified: student.is_active,
          platform: "CampusCode",
        },
      },
    });
  } catch (error) {
    console.error("Get Student Digital ID Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch digital ID",
    });
  }
};


/*
  ============================================================
  PUBLIC DIGITAL CARD VERIFICATION
  ============================================================

  GET /api/public/digital-card/:campusId

  Authentication:
  - NOT required

  Purpose:
  - Used when someone scans the QR code on a student's
    CampusCode Digital ID.
  ============================================================
*/
export const verifyStudentDigitalCard = async (req, res) => {
  try {
    const { campusId } = req.params;

    // --------------------------------------------------
    // 1. Validate campus ID
    // --------------------------------------------------
    if (!campusId || !campusId.trim()) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: "Campus ID is required",
      });
    }

    const normalizedCampusId = campusId.trim();

    // --------------------------------------------------
    // 2. Find student
    //
    // IMPORTANT:
    // Only return information that is safe to expose
    // publicly through QR verification.
    // --------------------------------------------------
    const studentResult = await pool.query(
      `
      SELECT
        id,
        name,
        avatar_url,
        skills,
        is_active,
        campus_code_id,
        created_at
      FROM users
      WHERE campus_code_id = $1
        AND role = 'STUDENT'
      LIMIT 1
      `,
      [normalizedCampusId]
    );

    // --------------------------------------------------
    // 3. Student/card not found
    // --------------------------------------------------
    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: "Digital ID not found",
      });
    }

    const student = studentResult.rows[0];

    // --------------------------------------------------
    // 4. Check whether the account is active
    // --------------------------------------------------
    if (!student.is_active) {
      return res.status(403).json({
        success: false,
        verified: false,
        message: "This Digital ID is inactive",
      });
    }

    // --------------------------------------------------
    // 5. Get public participation statistics
    // --------------------------------------------------
    const hackathonResult = await pool.query(
      `
      SELECT COUNT(*) AS total_hackathons
      FROM hackathon_participants
      WHERE user_id = $1
      `,
      [student.id]
    );

    const completedResult = await pool.query(
      `
      SELECT COUNT(*) AS completed_hackathons
      FROM hackathon_participants hp
      INNER JOIN hackathons h
        ON h.id = hp.hackathon_id
      WHERE hp.user_id = $1
        AND h.status = 'COMPLETED'
      `,
      [student.id]
    );

    const teamResult = await pool.query(
      `
      SELECT COUNT(DISTINCT team_id) AS total_teams
      FROM team_members
      WHERE user_id = $1
      `,
      [student.id]
    );

    // --------------------------------------------------
    // 6. Return verified public Digital Card
    // --------------------------------------------------
    return res.status(200).json({
      success: true,
      verified: true,

      message: "Digital ID verified successfully",

      digital_card: {
        platform: "CampusCode",

        verification: {
          verified: true,
          status: "ACTIVE",
          verified_at: new Date().toISOString(),
        },

        participant: {
          campus_id: student.campus_code_id,
          name: student.name,
          avatar_url: student.avatar_url,
          skills: student.skills,
          joined_at: student.created_at,
        },

        statistics: {
          total_hackathons: Number(
            hackathonResult.rows[0].total_hackathons
          ),

          total_teams: Number(
            teamResult.rows[0].total_teams
          ),

          completed_hackathons: Number(
            completedResult.rows[0].completed_hackathons
          ),
        },
      },
    });
  } catch (error) {
    console.error(
      "Verify Student Digital Card Error:",
      error
    );

    return res.status(500).json({
      success: false,
      verified: false,
      message: "Unable to verify Digital ID",
    });
  }
};