import pool from "../config/db.js";

/*
=========================================================
HACKMATE — STUDENT AI TEAMMATE FINDER
=========================================================

Purpose:
- Find the student's current team for a hackathon
- Read the student's skills
- Read current team members' skills
- Find registered students who are not already in a team
- Calculate complementary skill match
- Recommend teammates

Important:
- This does NOT use friend requests
- This does NOT use "Invite"
- It is hackathon-specific
- Existing team joining is handled by /api/teams/:id/join
- Maximum team size is currently 4
=========================================================
*/


/* =========================================================
   HELPER — NORMALIZE SKILLS
========================================================= */

function normalizeSkills(skills) {
  if (!Array.isArray(skills)) {
    return [];
  }

  return skills
    .map((skill) => String(skill).trim())
    .filter(Boolean)
    .map((skill) => skill.toLowerCase());
}


/* =========================================================
   HELPER — DISPLAY SKILLS
========================================================= */

function uniqueSkills(skills) {
  return [...new Set(skills)];
}


/* =========================================================
   HELPER — CALCULATE SKILL MATCH
========================================================= */

function calculateMatchScore(mySkills, candidateSkills) {
  const mine = normalizeSkills(mySkills);
  const candidate = normalizeSkills(candidateSkills);

  if (candidate.length === 0) {
    return {
      score: 0,
      sharedSkills: [],
      complementarySkills: [],
    };
  }

  const sharedSkills = candidate.filter((skill) =>
    mine.includes(skill)
  );

  const complementarySkills = candidate.filter(
    (skill) => !mine.includes(skill)
  );

  /*
    HackMate should prioritize complementary skills.

    Formula:
    - 60 points for complementary skills
    - 25 points for shared skills
    - 15 points for having a useful number of skills
  */

  const complementaryScore = Math.min(
    complementarySkills.length * 15,
    60
  );

  const sharedScore = Math.min(
    sharedSkills.length * 8,
    25
  );

  const skillDepthScore =
    candidate.length >= 3
      ? 15
      : candidate.length === 2
        ? 10
        : candidate.length === 1
          ? 5
          : 0;

  let score =
    complementaryScore +
    sharedScore +
    skillDepthScore;

  score = Math.min(Math.round(score), 100);

  return {
    score,
    sharedSkills: uniqueSkills(sharedSkills),
    complementarySkills: uniqueSkills(
      complementarySkills
    ),
  };
}


/* =========================================================
   HELPER — BUILD REASON
========================================================= */

function buildReason(complementarySkills, sharedSkills) {
  if (complementarySkills.length > 0) {
    const skills = complementarySkills
      .slice(0, 3)
      .map((skill) => formatSkill(skill))
      .join(", ");

    return `${skills} ${complementarySkills.length === 1 ? "skill fills" : "skills fill"} your team's skill gap`;
  }

  if (sharedSkills.length > 0) {
    const skills = sharedSkills
      .slice(0, 3)
      .map((skill) => formatSkill(skill))
      .join(", ");

    return `Strong overlap in ${skills}`;
  }

  return "Potential teammate based on available skills";
}


/* =========================================================
   HELPER — FORMAT SKILL
========================================================= */

function formatSkill(skill) {
  const specialCases = {
    "ai / ml": "AI / ML",
    "ai/ml": "AI / ML",
    "ui / ux": "UI / UX",
    "ui/ux": "UI / UX",
    "node.js": "Node.js",
    "react.js": "React.js",
    "next.js": "Next.js",
    "express.js": "Express.js",
    "mongodb": "MongoDB",
    "postgresql": "PostgreSQL",
    "tensorflow": "TensorFlow",
    "fastapi": "FastAPI",
    "python": "Python",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "java": "Java",
    "kotlin": "Kotlin",
    "flutter": "Flutter",
    "figma": "Figma",
  };

  if (specialCases[skill]) {
    return specialCases[skill];
  }

  return skill
    .split(" ")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}


/* =========================================================
   GET HACKMATE RECOMMENDATIONS
========================================================= */

export async function getHackMateRecommendations(
  req,
  res
) {
  try {
    const { hackathonId } = req.params;
    const userId = req.user.id;

    /* -----------------------------------------------------
       VALIDATE USER ROLE
    ----------------------------------------------------- */

    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message:
          "Only students can use HackMate",
      });
    }


    /* -----------------------------------------------------
       GET HACKATHON
    ----------------------------------------------------- */

    const hackathonResult = await pool.query(
      `
      SELECT
        id,
        title,
        status,
        max_teams,
        current_round
      FROM hackathons
      WHERE id = $1
      `,
      [hackathonId]
    );

    if (hackathonResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    const hackathon =
      hackathonResult.rows[0];


    /* -----------------------------------------------------
       CHECK STUDENT REGISTRATION
    ----------------------------------------------------- */

    const registrationResult =
      await pool.query(
        `
        SELECT
          id,
          status
        FROM hackathon_participants
        WHERE hackathon_id = $1
          AND user_id = $2
        `,
        [hackathonId, userId]
      );

    if (registrationResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message:
          "You must register for this hackathon before using HackMate",
      });
    }

    const registration =
      registrationResult.rows[0];

    if (
      registration.status === "WITHDRAWN"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You have withdrawn from this hackathon",
      });
    }


    /* -----------------------------------------------------
       GET CURRENT STUDENT
    ----------------------------------------------------- */

    const studentResult = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        avatar_url,
        bio,
        skills
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student =
      studentResult.rows[0];


    /* -----------------------------------------------------
       GET CURRENT TEAM
    ----------------------------------------------------- */

    const teamResult = await pool.query(
      `
      SELECT
        t.id,
        t.name,
        t.leader_id,
        t.status
      FROM teams t
      INNER JOIN team_members tm
        ON tm.team_id = t.id
      WHERE t.hackathon_id = $1
        AND tm.user_id = $2
      LIMIT 1
      `,
      [hackathonId, userId]
    );

    const currentTeam =
      teamResult.rows.length > 0
        ? teamResult.rows[0]
        : null;


    /* -----------------------------------------------------
       GET CURRENT TEAM MEMBERS
    ----------------------------------------------------- */

    let currentTeamMembers = [];

    if (currentTeam) {
      const membersResult =
        await pool.query(
          `
          SELECT
            u.id,
            u.name,
            u.email,
            u.avatar_url,
            u.bio,
            u.skills,
            tm.role,
            tm.joined_at
          FROM team_members tm
          INNER JOIN users u
            ON u.id = tm.user_id
          WHERE tm.team_id = $1
          ORDER BY tm.joined_at ASC
          `,
          [currentTeam.id]
        );

      currentTeamMembers =
        membersResult.rows;
    }


    /* -----------------------------------------------------
       CALCULATE CURRENT TEAM SKILLS
    ----------------------------------------------------- */

    const mySkills = normalizeSkills(
      student.skills
    );

    const teamSkills = uniqueSkills(
      currentTeamMembers.flatMap(
        (member) =>
          normalizeSkills(member.skills)
      )
    );

    const missingSkills = [];


    /*
      We identify common hackathon-oriented
      skill categories.

      These are only used to explain the
      team's skill gaps to the student.
    */

    const usefulSkillGroups = [
      [
        "frontend",
        "react",
        "react.js",
        "next.js",
        "html",
        "css",
        "javascript",
        "typescript",
        "tailwind",
      ],
      [
        "backend",
        "node.js",
        "node",
        "express.js",
        "express",
        "python",
        "java",
        "fastapi",
        "spring boot",
      ],
      [
        "database",
        "mongodb",
        "postgresql",
        "mysql",
        "sql",
        "firebase",
      ],
      [
        "ai / ml",
        "ai/ml",
        "machine learning",
        "tensorflow",
        "pytorch",
        "python",
      ],
      [
        "ui / ux",
        "ui/ux",
        "figma",
        "design",
        "design systems",
      ],
      [
        "mobile",
        "android",
        "kotlin",
        "flutter",
        "react native",
      ],
      [
        "cloud",
        "aws",
        "azure",
        "gcp",
        "docker",
      ],
    ];

    for (const group of usefulSkillGroups) {
      const groupPresent = group.some(
        (skill) =>
          teamSkills.includes(
            skill.toLowerCase()
          )
      );

      if (!groupPresent) {
        missingSkills.push(
          formatSkill(group[0])
        );
      }
    }


    /* -----------------------------------------------------
       TEAM CAPACITY
    ----------------------------------------------------- */

    const teamSize =
      currentTeamMembers.length;

    const maxTeamSize = 4;

    const availableSlots = currentTeam
      ? Math.max(
          maxTeamSize - teamSize,
          0
        )
      : 0;


    /* -----------------------------------------------------
       FIND REGISTERED STUDENTS
       WHO ARE NOT ALREADY IN A TEAM
    ----------------------------------------------------- */

    const candidatesResult =
      await pool.query(
        `
        SELECT
          hp.user_id,
          u.name,
          u.email,
          u.avatar_url,
          u.bio,
          u.skills,
          hp.status
        FROM hackathon_participants hp

        INNER JOIN users u
          ON u.id = hp.user_id

        WHERE hp.hackathon_id = $1
          AND hp.status IN ('REGISTERED', 'ACTIVE')
          AND hp.user_id <> $2

          AND NOT EXISTS (
            SELECT 1
            FROM team_members tm
            INNER JOIN teams t
              ON t.id = tm.team_id
            WHERE t.hackathon_id = $1
              AND tm.user_id = hp.user_id
          )

        ORDER BY u.name ASC
        `,
        [hackathonId, userId]
      );


    /* -----------------------------------------------------
       BUILD RECOMMENDATIONS
    ----------------------------------------------------- */

    const recommendations =
      candidatesResult.rows
        .map((candidate) => {
          const candidateSkills =
            normalizeSkills(
              candidate.skills
            );

          /*
            For a student without a team,
            compare against their own skills.

            For a student with a team,
            compare against all team skills.
          */

          const baseSkills =
            currentTeam
              ? teamSkills
              : mySkills;

          const {
            score,
            sharedSkills,
            complementarySkills,
          } =
            calculateMatchScore(
              baseSkills,
              candidateSkills
            );

          const reason =
            buildReason(
              complementarySkills,
              sharedSkills
            );

          return {
            user_id:
              candidate.user_id,

            name:
              candidate.name,

            email:
              candidate.email,

            avatar_url:
              candidate.avatar_url,

            bio:
              candidate.bio,

            skills:
              candidateSkills.map(
                formatSkill
              ),

            match_score:
              score,

            shared_skills:
              sharedSkills.map(
                formatSkill
              ),

            complementary_skills:
              complementarySkills.map(
                formatSkill
              ),

            reason,
          };
        })

        /*
          Only show useful recommendations.
          Candidates with zero skill information
          are still allowed at the bottom if
          there are not enough better matches.
        */
        .sort(
          (a, b) =>
            b.match_score -
            a.match_score
        )

        .slice(
          0,
          currentTeam
            ? Math.max(
                availableSlots,
                6
              )
            : 10
        );


    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    return res.json({
      success: true,

      hackathon: {
        id: hackathon.id,
        title: hackathon.title,
        status: hackathon.status,
        current_round:
          hackathon.current_round,
        max_teams:
          hackathon.max_teams,
      },

      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        avatar_url:
          student.avatar_url,
        bio: student.bio,
        skills:
          mySkills.map(formatSkill),
      },

      my_team: currentTeam
        ? {
            id: currentTeam.id,
            name: currentTeam.name,
            leader_id:
              currentTeam.leader_id,
            status:
              currentTeam.status,
            member_count:
              currentTeamMembers.length,
            max_size:
              maxTeamSize,
            available_slots:
              availableSlots,

            members:
              currentTeamMembers.map(
                (member) => ({
                  id: member.id,
                  name: member.name,
                  email: member.email,
                  avatar_url:
                    member.avatar_url,
                  bio: member.bio,
                  skills:
                    normalizeSkills(
                      member.skills
                    ).map(formatSkill),
                  role: member.role,
                  joined_at:
                    member.joined_at,
                })
              ),

            skills:
              teamSkills.map(formatSkill),

            missing_skills:
              missingSkills,
          }
        : null,

      recommendations,

      meta: {
        total_candidates:
          candidatesResult.rows.length,

        recommendation_count:
          recommendations.length,

        team_size:
          teamSize,

        max_team_size:
          maxTeamSize,

        available_slots:
          availableSlots,
      },
    });
  } catch (error) {
    console.error(
      "GET HACKMATE RECOMMENDATIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to generate HackMate recommendations",
    });
  }
}