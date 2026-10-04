import pool from "../config/db.js";

// ============================================================
// GEMINI INTERACTIONS API
// ============================================================

const GEMINI_INTERACTIONS_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

// ============================================================
// DEFAULT RULES CONFIG
// ============================================================

const DEFAULT_RULES_FILE_NAME =
  "CampusCode Default Hackathon Rules";

const DEFAULT_RULES_FILE_PATH =
  "__CAMPUSCODE_DEFAULT_RULES__";

// ============================================================
// GEMINI CONFIG
// ============================================================

const getGeminiConfig = () => ({
  apiKey: process.env.GEMINI_API_KEY,
  model:
    process.env.GEMINI_MODEL ||
    "gemini-3.6-flash",
});

// ============================================================
// DEFAULT RULES
//
// Kept inside RuleBot so the controller does not depend on
// named exports from defaultHackathonRules.js.
// ============================================================

const DEFAULT_RULES = [
  {
    id: 1,
    category: "Eligibility",
    rule:
      "Only participants who satisfy the eligibility conditions published for the hackathon may participate.",
  },
  {
    id: 2,
    category: "Eligibility",
    rule:
      "Every participant must register using their own CampusCode account.",
  },
  {
    id: 3,
    category: "Eligibility",
    rule:
      "Participants must provide accurate registration information.",
  },
  {
    id: 4,
    category: "Eligibility",
    rule:
      "A participant must meet any age, student-status, institution, or geographic requirements announced for the hackathon.",
  },
  {
    id: 5,
    category: "Registration",
    rule:
      "Registration must be completed before the published registration deadline.",
  },
  {
    id: 6,
    category: "Registration",
    rule:
      "A participant may not create duplicate registrations for the same hackathon.",
  },
  {
    id: 7,
    category: "Registration",
    rule:
      "Organizers may verify participant eligibility before allowing progression to later rounds.",
  },
  {
    id: 8,
    category: "Registration",
    rule:
      "Participants are responsible for keeping their CampusCode account information current.",
  },
  {
    id: 9,
    category: "Registration",
    rule:
      "Registration does not guarantee selection for every round of the hackathon.",
  },
  {
    id: 10,
    category: "Registration",
    rule:
      "If a registration requirement is unclear, the organizer's published announcement takes precedence.",
  },

  {
    id: 11,
    category: "Teams",
    rule:
      "A participant may belong to only one team in a particular hackathon.",
  },
  {
    id: 12,
    category: "Teams",
    rule:
      "Every team member must be a registered participant of the same hackathon.",
  },
  {
    id: 13,
    category: "Teams",
    rule:
      "Teams must follow the team-size limit configured or announced by the organizer.",
  },
  {
    id: 14,
    category: "Teams",
    rule:
      "A team leader is responsible for coordinating the team's submission unless the organizer specifies another process.",
  },
  {
    id: 15,
    category: "Teams",
    rule:
      "Team members are responsible for work submitted under their team's name.",
  },
  {
    id: 16,
    category: "Teams",
    rule:
      "Participants should join or create teams before the team-formation deadline.",
  },
  {
    id: 17,
    category: "Teams",
    rule:
      "A participant must not join a team using another person's account.",
  },
  {
    id: 18,
    category: "Teams",
    rule:
      "Teams must not use false identities or impersonate another participant.",
  },
  {
    id: 19,
    category: "Teams",
    rule:
      "Team membership changes are subject to the hackathon's configured workflow and deadlines.",
  },
  {
    id: 20,
    category: "Teams",
    rule:
      "A team cannot exceed the maximum team size configured for the hackathon.",
  },
  {
    id: 21,
    category: "Teams",
    rule:
      "A participant who leaves a team remains subject to the hackathon's one-team rule.",
  },
  {
    id: 22,
    category: "Teams",
    rule:
      "Team leaders must ensure that team details are accurate before submission.",
  },
  {
    id: 23,
    category: "Teams",
    rule:
      "Organizers may reject teams that do not satisfy the published team requirements.",
  },
  {
    id: 24,
    category: "Teams",
    rule:
      "Teams must not share a single participant account between multiple people.",
  },

  {
    id: 25,
    category: "Teams",
    rule:
      "A participant must use their own account when joining or leaving a team.",
  },

  {
    id: 26,
    category: "Submissions",
    rule:
      "Teams must submit their project through the official CampusCode submission process.",
  },
  {
    id: 27,
    category: "Submissions",
    rule:
      "A submission must be made before the applicable round deadline.",
  },
  {
    id: 28,
    category: "Submissions",
    rule:
      "Teams are responsible for ensuring that submitted information is accurate.",
  },
  {
    id: 29,
    category: "Submissions",
    rule:
      "Teams should submit all materials requested for the applicable round.",
  },
  {
    id: 30,
    category: "Submissions",
    rule:
      "Late submissions are subject to the organizer's published rules and extensions.",
  },
  {
    id: 31,
    category: "Submissions",
    rule:
      "A team should not submit another team's project as its own.",
  },
  {
    id: 32,
    category: "Submissions",
    rule:
      "Teams are responsible for checking their submission before the deadline.",
  },
  {
    id: 33,
    category: "Submissions",
    rule:
      "Organizers may reject incomplete submissions.",
  },
  {
    id: 34,
    category: "Submissions",
    rule:
      "Submission requirements may differ between hackathon rounds.",
  },
  {
    id: 35,
    category: "Submissions",
    rule:
      "The latest valid submission accepted by the platform is subject to the round's submission workflow.",
  },

  {
    id: 36,
    category: "Projects",
    rule:
      "Teams are responsible for the functionality and accuracy of their submitted project.",
  },
  {
    id: 37,
    category: "Projects",
    rule:
      "Teams may use technologies permitted by the organizer.",
  },
  {
    id: 38,
    category: "Projects",
    rule:
      "Third-party libraries and frameworks may be used unless prohibited by the specific hackathon rules.",
  },
  {
    id: 39,
    category: "Projects",
    rule:
      "Teams are responsible for complying with licenses applicable to third-party software and assets they use.",
  },
  {
    id: 40,
    category: "Projects",
    rule:
      "Teams should provide working project links when requested.",
  },

  {
    id: 41,
    category: "AI",
    rule:
      "AI tools may be used unless the specific hackathon rules prohibit or restrict their use.",
  },
  {
    id: 42,
    category: "AI",
    rule:
      "Teams remain responsible for the correctness of AI-assisted work.",
  },
  {
    id: 43,
    category: "AI",
    rule:
      "Teams remain responsible for the originality and ownership of their final submission.",
  },
  {
    id: 44,
    category: "AI",
    rule:
      "Using AI does not transfer responsibility for the submitted project to CampusCode or the AI provider.",
  },
  {
    id: 45,
    category: "AI",
    rule:
      "Teams must follow any AI disclosure requirements announced by the organizer.",
  },

  {
    id: 46,
    category: "Originality",
    rule:
      "Submitted work must be created by the participating team.",
  },
  {
    id: 47,
    category: "Originality",
    rule:
      "Plagiarism may result in rejection or disqualification.",
  },
  {
    id: 48,
    category: "Originality",
    rule:
      "Teams must not intentionally submit another team's work as their own.",
  },
  {
    id: 49,
    category: "Originality",
    rule:
      "Teams should acknowledge significant third-party assets where appropriate.",
  },
  {
    id: 50,
    category: "Originality",
    rule:
      "False claims about project ownership may result in organizer action.",
  },

  {
    id: 51,
    category: "Evaluation",
    rule:
      "Organizers may evaluate submissions according to the criteria published for each round.",
  },
  {
    id: 52,
    category: "Evaluation",
    rule:
      "Evaluation criteria may differ between rounds.",
  },
  {
    id: 53,
    category: "Evaluation",
    rule:
      "AI-generated analysis may be advisory and does not automatically replace the organizer's final decision.",
  },
  {
    id: 54,
    category: "Evaluation",
    rule:
      "Organizer decisions are final unless an official correction or appeal process is provided.",
  },
  {
    id: 55,
    category: "Evaluation",
    rule:
      "A team may be evaluated on the materials requested for the applicable round.",
  },

  {
    id: 56,
    category: "Rounds",
    rule:
      "Each hackathon round has its own submission and evaluation requirements.",
  },
  {
    id: 57,
    category: "Rounds",
    rule:
      "Teams must satisfy the requirements of the current round before progressing.",
  },
  {
    id: 58,
    category: "Rounds",
    rule:
      "The organizer controls the progression decisions for each round.",
  },
  {
    id: 59,
    category: "Rounds",
    rule:
      "Round deadlines are determined by the published hackathon schedule.",
  },
  {
    id: 60,
    category: "Rounds",
    rule:
      "A team that does not progress to a later round cannot participate in that later round unless the organizer changes the decision.",
  },

  {
    id: 61,
    category: "Conduct",
    rule:
      "Participants must behave respectfully toward other participants, organizers, judges, and staff.",
  },
  {
    id: 62,
    category: "Conduct",
    rule:
      "Harassment and abusive behavior are prohibited.",
  },
  {
    id: 63,
    category: "Conduct",
    rule:
      "Threats and intimidation are prohibited.",
  },
  {
    id: 64,
    category: "Conduct",
    rule:
      "Participants must not intentionally disrupt the hackathon.",
  },
  {
    id: 65,
    category: "Conduct",
    rule:
      "Participants must follow reasonable instructions from authorized organizers and administrators.",
  },

  {
    id: 66,
    category: "Cheating",
    rule:
      "Cheating or deliberate manipulation of the hackathon process may result in rejection or disqualification.",
  },
  {
    id: 67,
    category: "Cheating",
    rule:
      "Participants must not impersonate other participants.",
  },
  {
    id: 68,
    category: "Cheating",
    rule:
      "Participants must not intentionally manipulate platform data to gain an unfair advantage.",
  },
  {
    id: 69,
    category: "Cheating",
    rule:
      "Participants must not submit fraudulent information.",
  },
  {
    id: 70,
    category: "Cheating",
    rule:
      "Organizers may investigate suspected violations.",
  },

  {
    id: 71,
    category: "Security",
    rule:
      "Participants must not attempt to access accounts or data belonging to other users.",
  },
  {
    id: 72,
    category: "Security",
    rule:
      "Participants must not intentionally exploit CampusCode vulnerabilities to gain an unfair advantage.",
  },
  {
    id: 73,
    category: "Security",
    rule:
      "Passwords, API keys, access tokens, and private credentials must not be included in public project submissions.",
  },
  {
    id: 74,
    category: "Security",
    rule:
      "Teams are responsible for securing their repositories and deployments.",
  },
  {
    id: 75,
    category: "Security",
    rule:
      "Security incidents should be reported to the appropriate organizer or administrator.",
  },

  {
    id: 76,
    category: "Deadlines",
    rule:
      "Participants are responsible for tracking published hackathon deadlines.",
  },
  {
    id: 77,
    category: "Deadlines",
    rule:
      "A submission after a deadline may be rejected unless an extension is officially announced.",
  },
  {
    id: 78,
    category: "Deadlines",
    rule:
      "Organizer announcements may modify a deadline when officially published.",
  },
  {
    id: 79,
    category: "Deadlines",
    rule:
      "Participants should not rely on unofficial deadline information.",
  },
  {
    id: 80,
    category: "Deadlines",
    rule:
      "The platform's configured round schedule should be treated as the primary source for round timing.",
  },

  {
    id: 81,
    category: "Results",
    rule:
      "Round results are determined through the applicable organizer evaluation process.",
  },
  {
    id: 82,
    category: "Results",
    rule:
      "A selected team may progress to a later round according to the organizer's decision.",
  },
  {
    id: 83,
    category: "Results",
    rule:
      "Final results may require administrator approval before publication.",
  },
  {
    id: 84,
    category: "Results",
    rule:
      "Published final results should be treated as the official hackathon results.",
  },
  {
    id: 85,
    category: "Results",
    rule:
      "RuleBot does not change or override official results.",
  },

  {
    id: 86,
    category: "Disqualification",
    rule:
      "Serious rule violations may result in disqualification.",
  },
  {
    id: 87,
    category: "Disqualification",
    rule:
      "Plagiarism may result in disqualification.",
  },
  {
    id: 88,
    category: "Disqualification",
    rule:
      "Fraudulent information may result in disqualification.",
  },
  {
    id: 89,
    category: "Disqualification",
    rule:
      "Cheating may result in disqualification.",
  },
  {
    id: 90,
    category: "Disqualification",
    rule:
      "Serious misconduct may result in disqualification.",
  },

  {
    id: 91,
    category: "Privacy",
    rule:
      "Participants should avoid submitting unnecessary personal information in project materials.",
  },
  {
    id: 92,
    category: "Privacy",
    rule:
      "Participants should avoid submitting confidential information in public project materials.",
  },
  {
    id: 93,
    category: "Privacy",
    rule:
      "Personal information included in a project should be handled appropriately.",
  },
  {
    id: 94,
    category: "Privacy",
    rule:
      "Teams are responsible for ensuring they have permission to use personal data included in their project.",
  },
  {
    id: 95,
    category: "Privacy",
    rule:
      "Passwords and authentication credentials must never be submitted as project content.",
  },

  {
    id: 96,
    category: "Platform",
    rule:
      "Participants must use CampusCode according to its intended hackathon workflow.",
  },
  {
    id: 97,
    category: "Platform",
    rule:
      "Participants should keep their CampusCode account information accurate.",
  },
  {
    id: 98,
    category: "Platform",
    rule:
      "Participants should report technical problems through the appropriate support or organizer channel.",
  },
  {
    id: 99,
    category: "Platform",
    rule:
      "Platform availability does not automatically extend hackathon deadlines.",
  },
  {
    id: 100,
    category: "Platform",
    rule:
      "Organizer instructions take precedence when a platform workflow requires manual intervention.",
  },

  {
    id: 101,
    category: "Organizer",
    rule:
      "The hackathon organizer may publish additional rules specific to the event.",
  },
  {
    id: 102,
    category: "Organizer",
    rule:
      "Organizer-specific rules may override general default rules.",
  },
  {
    id: 103,
    category: "Organizer",
    rule:
      "Official organizer announcements should be followed when they modify hackathon requirements.",
  },
  {
    id: 104,
    category: "Organizer",
    rule:
      "Organizers may configure round deadlines and requirements for their hackathon.",
  },
  {
    id: 105,
    category: "Organizer",
    rule:
      "Organizers may make final evaluation decisions according to the published evaluation process.",
  },

  {
    id: 106,
    category: "Judging",
    rule:
      "Judges or reviewers may evaluate projects according to the criteria provided by the organizer.",
  },
  {
    id: 107,
    category: "Judging",
    rule:
      "Judging criteria may include technical implementation, originality, usefulness, presentation, or other published criteria.",
  },
  {
    id: 108,
    category: "Judging",
    rule:
      "A judge's evaluation is part of the official hackathon evaluation process.",
  },
  {
    id: 109,
    category: "Judging",
    rule:
      "RuleBot cannot predict a team's final judging result.",
  },
  {
    id: 110,
    category: "Judging",
    rule:
      "Only authorized organizers or judges can provide official judging decisions.",
  },

  {
    id: 111,
    category: "Prizes",
    rule:
      "Prize eligibility is subject to the conditions published by the hackathon organizer or sponsor.",
  },
  {
    id: 112,
    category: "Prizes",
    rule:
      "A team may be required to provide accurate identity or eligibility information before receiving a prize.",
  },
  {
    id: 113,
    category: "Prizes",
    rule:
      "The organizer may verify winner eligibility before final prize distribution.",
  },
  {
    id: 114,
    category: "Prizes",
    rule:
      "Prize details are determined by the official hackathon announcement.",
  },
  {
    id: 115,
    category: "Prizes",
    rule:
      "RuleBot must not guarantee that a participant will receive a prize.",
  },

  {
    id: 116,
    category: "Platform Safety",
    rule:
      "Participants are responsible for protecting their own CampusCode accounts.",
  },
  {
    id: 117,
    category: "Platform Safety",
    rule:
      "Participants should not share account credentials.",
  },
  {
    id: 118,
    category: "Platform Safety",
    rule:
      "Participants must not use another participant's account.",
  },
  {
    id: 119,
    category: "Platform Safety",
    rule:
      "Misuse of CampusCode features to gain an unfair competitive advantage may result in account or hackathon action.",
  },

  {
    id: 120,
    category: "General",
    rule:
      "Organizer-specific rules, announcements, and configured hackathon requirements take precedence over these general default rules.",
  },
  {
    id: 121,
    category: "General",
    rule:
      "If RuleBot cannot find an answer in the active rules, it must say that the information is not specified rather than inventing an answer.",
  },
  {
    id: 122,
    category: "General",
    rule:
      "RuleBot provides informational guidance and does not override decisions made by authorized hackathon organizers or administrators.",
  },
];

// ============================================================
// DEFAULT RULES TEXT
// ============================================================

const DEFAULT_RULES_TEXT =
  DEFAULT_RULES.map(
    (item) =>
      `${item.id}. [${item.category}] ${item.rule}`
  ).join("\n");

const DEFAULT_RULES_COUNT =
  DEFAULT_RULES.length;

// ============================================================
// GET DEFAULT RULES
//
// GET /api/rulebot/default-rules
// ============================================================

export async function getDefaultRules(
  req,
  res
) {
  return res.json({
    success: true,

    rules:
      DEFAULT_RULES,

    count:
      DEFAULT_RULES_COUNT,

    file_name:
      DEFAULT_RULES_FILE_NAME,
  });
}

// ============================================================
// GET HACKATHON
// ============================================================

async function getHackathon(
  hackathonId
) {
  const result =
    await pool.query(
      `
      SELECT
        id,
        title,
        description,
        organizer_id,
        status
      FROM hackathons
      WHERE id = $1
      `,
      [hackathonId]
    );

  return (
    result.rows[0] ||
    null
  );
}

// ============================================================
// CHECK ORGANIZER / ADMIN ACCESS
// ============================================================

function hasRulesManagementAccess(
  user,
  hackathon
) {
  if (!user || !hackathon) {
    return false;
  }

  if (
    user.role === "ADMIN"
  ) {
    return true;
  }

  return (
    user.role === "ORGANIZER" &&
    String(
      hackathon.organizer_id
    ) ===
      String(user.id)
  );
}

// ============================================================
// GET ACTIVE RULES
// ============================================================

async function getActiveRules(
  hackathonId
) {
  const result =
    await pool.query(
      `
      SELECT
        id,
        hackathon_id,
        file_name,
        file_path,
        extracted_text,
        uploaded_by,
        created_at,
        updated_at
      FROM hackathon_rules
      WHERE hackathon_id = $1
      LIMIT 1
      `,
      [hackathonId]
    );

  return (
    result.rows[0] ||
    null
  );
}

// ============================================================
// USE DEFAULT RULES
//
// POST /api/rulebot/:hackathonId/rules/default
// ============================================================

export async function useDefaultRules(
  req,
  res
) {
  try {
    const {
      hackathonId,
    } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const hackathon =
      await getHackathon(
        hackathonId
      );

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message:
          "Hackathon not found",
      });
    }

    if (
      !hasRulesManagementAccess(
        req.user,
        hackathon
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only the hackathon organizer or admin can approve default rules",
      });
    }

    const result =
      await pool.query(
        `
        INSERT INTO hackathon_rules (
          hackathon_id,
          file_name,
          file_path,
          extracted_text,
          uploaded_by,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          NOW()
        )

        ON CONFLICT (hackathon_id)
        DO UPDATE SET
          file_name =
            EXCLUDED.file_name,

          file_path =
            EXCLUDED.file_path,

          extracted_text =
            EXCLUDED.extracted_text,

          uploaded_by =
            EXCLUDED.uploaded_by,

          updated_at =
            NOW()

        RETURNING
          id,
          hackathon_id,
          file_name,
          file_path,
          uploaded_by,
          created_at,
          updated_at
        `,
        [
          hackathonId,

          DEFAULT_RULES_FILE_NAME,

          DEFAULT_RULES_FILE_PATH,

          DEFAULT_RULES_TEXT,

          req.user.id,
        ]
      );

    return res.status(201).json({
      success: true,

      message:
        "Default hackathon rules approved successfully",

      rules:
        result.rows[0],

      is_default: true,

      rule_count:
        DEFAULT_RULES_COUNT,
    });
  } catch (error) {
    console.error(
      "USE DEFAULT RULES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Unable to approve default hackathon rules",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
}

// ============================================================
// GET RULES
//
// GET /api/rulebot/:hackathonId/rules
// ============================================================

export async function getRules(
  req,
  res
) {
  try {
    const {
      hackathonId,
    } = req.params;

    const hackathon =
      await getHackathon(
        hackathonId
      );

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message:
          "Hackathon not found",
      });
    }

    const activeRules =
      await getActiveRules(
        hackathonId
      );

    const isDefaultActive =
      activeRules?.file_path ===
      DEFAULT_RULES_FILE_PATH;

    return res.json({
      success: true,

      hackathon: {
        id:
          hackathon.id,

        title:
          hackathon.title,
      },

      has_rules:
        Boolean(activeRules),

      is_approved:
        Boolean(activeRules),

      is_default:
        isDefaultActive,

      rule_count:
        isDefaultActive
          ? DEFAULT_RULES_COUNT
          : activeRules
            ? null
            : 0,

      rules:
        activeRules
          ? {
              id:
                activeRules.id,

              hackathon_id:
                activeRules.hackathon_id,

              file_name:
                activeRules.file_name,

              uploaded_by:
                activeRules.uploaded_by,

              created_at:
                activeRules.created_at,

              updated_at:
                activeRules.updated_at,
            }
          : null,

      default_rules: {
        available: true,

        count:
          DEFAULT_RULES_COUNT,

        file_name:
          DEFAULT_RULES_FILE_NAME,

        is_active:
          isDefaultActive,
      },

      active_source:
        isDefaultActive
          ? "DEFAULT_RULES"
          : activeRules
            ? "STORED_RULES"
            : "NONE",
    });
  } catch (error) {
    console.error(
      "GET RULES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Unable to fetch hackathon rules status",
    });
  }
}

// ============================================================
// ASK RULEBOT
//
// POST /api/rulebot/:hackathonId/ask
// ============================================================

export async function askRuleBot(
  req,
  res
) {
  try {
    const {
      hackathonId,
    } = req.params;

    const {
      question,
    } = req.body || {};

    // --------------------------------------------------------
    // Authentication
    // --------------------------------------------------------

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    // --------------------------------------------------------
    // Validate question
    // --------------------------------------------------------

    if (
      !question ||
      typeof question !==
        "string" ||
      !question.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Question is required",
      });
    }

    const cleanQuestion =
      question.trim();

    if (
      cleanQuestion.length >
      1000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Question is too long. Maximum 1000 characters.",
      });
    }

    // --------------------------------------------------------
    // Hackathon
    // --------------------------------------------------------

    const hackathon =
      await getHackathon(
        hackathonId
      );

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message:
          "Hackathon not found",
      });
    }

    // --------------------------------------------------------
    // Active rules
    // --------------------------------------------------------

    const activeRules =
      await getActiveRules(
        hackathonId
      );

    if (!activeRules) {
      return res.status(409).json({
        success: false,

        message:
          "The organizer has not approved the default hackathon rules yet.",

        code:
          "RULES_NOT_APPROVED",
      });
    }

    const isDefaultActive =
      activeRules.file_path ===
      DEFAULT_RULES_FILE_PATH;

    const rulesText =
      isDefaultActive
        ? DEFAULT_RULES_TEXT
        : String(
            activeRules.extracted_text ||
              ""
          ).trim();

    if (!rulesText) {
      return res.status(409).json({
        success: false,

        message:
          "No active rules are available for this hackathon.",

        code:
          "RULES_EMPTY",
      });
    }

    // --------------------------------------------------------
    // Gemini config
    // --------------------------------------------------------

    const {
      apiKey,
      model,
    } = getGeminiConfig();

    if (!apiKey) {
      return res.status(500).json({
        success: false,

        message:
          "Gemini API key is not configured",
      });
    }

    // --------------------------------------------------------
    // System instruction
    // --------------------------------------------------------

    const systemInstruction = `
You are RuleBot, the official CampusCode hackathon rules assistant.

Answer questions ONLY from the active rules supplied below.

STRICT REQUIREMENTS:

1. Never invent a hackathon rule.

2. Never guess a deadline, team size, eligibility condition,
   score, prize, or disqualification condition.

3. If the answer is not explicitly supported by the active rules,
   say:
   "I couldn't find that information in the active hackathon rules."

4. If the rules say an organizer-specific setting controls something,
   tell the user that the organizer's configured value or announcement
   controls it.

5. Keep answers concise and easy for students to understand.

6. You may quote or paraphrase the applicable rule,
   but do not create new requirements.

7. Do not override organizer or administrator decisions.

8. Organizer-specific rules, announcements, and configured
   hackathon requirements take precedence over general rules.

HACKATHON:
${hackathon.title}

RULE SOURCE:
${
  isDefaultActive
    ? "CampusCode Default Hackathon Rules"
    : "Hackathon-specific stored rules"
}

ACTIVE RULES:
${rulesText}
`;

    // ========================================================
    // GEMINI INTERACTIONS REQUEST
    //
    // IMPORTANT:
    // Current API uses step_list.
    // ========================================================

    const geminiResponse =
      await fetch(
        GEMINI_INTERACTIONS_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-goog-api-key":
              apiKey,
          },

          body:
            JSON.stringify({
              model,

              input: [
                {
                  type:
                    "user_input",

                  content:
                    cleanQuestion,
                },
              ],

              system_instruction:
                systemInstruction,
            }),
        }
      );

    const geminiData =
      await geminiResponse.json();

    // --------------------------------------------------------
    // Gemini error
    // --------------------------------------------------------

    if (!geminiResponse.ok) {
      console.error(
        "GEMINI RULEBOT ERROR:",
        geminiData
      );

      return res.status(502).json({
        success: false,

        message:
          "RuleBot AI service is currently unavailable",

        gemini_error:
          process.env.NODE_ENV ===
          "development"
            ? geminiData
            : undefined,
      });
    }

    // --------------------------------------------------------
    // Extract answer from current steps response
    // --------------------------------------------------------

    let answer = "";

    if (
      Array.isArray(
        geminiData.steps
      )
    ) {
      for (
        const step of
          geminiData.steps
      ) {
        if (
          step?.type ===
            "model_output" &&
          Array.isArray(
            step.content
          )
        ) {
          for (
            const content of
              step.content
          ) {
            if (
              content?.type ===
                "text" &&
              typeof content.text ===
                "string"
            ) {
              answer +=
                content.text +
                "\n";
            }
          }
        }
      }
    }

    // --------------------------------------------------------
    // output_text fallback
    // --------------------------------------------------------

    if (
      !answer &&
      typeof geminiData.output_text ===
        "string"
    ) {
      answer =
        geminiData.output_text;
    }

    // --------------------------------------------------------
    // Legacy outputs fallback
    // --------------------------------------------------------

    if (
      !answer &&
      Array.isArray(
        geminiData.outputs
      )
    ) {
      for (
        const output of
          geminiData.outputs
      ) {
        if (
          typeof output?.text ===
          "string"
        ) {
          answer +=
            output.text +
            "\n";
        }

        if (
          Array.isArray(
            output?.content
          )
        ) {
          for (
            const content of
              output.content
          ) {
            if (
              typeof content?.text ===
              "string"
            ) {
              answer +=
                content.text +
                "\n";
            }
          }
        }
      }
    }

    answer =
      answer.trim();

    // --------------------------------------------------------
    // Empty response
    // --------------------------------------------------------

    if (!answer) {
      answer =
        "I couldn't generate an answer from the active hackathon rules.";
    }

    // --------------------------------------------------------
    // Final response
    // --------------------------------------------------------

    return res.json({
      success: true,

      hackathon: {
        id:
          hackathon.id,

        title:
          hackathon.title,
      },

      source: {
        type:
          isDefaultActive
            ? "DEFAULT_RULES"
            : "STORED_RULES",

        file_name:
          activeRules.file_name,

        is_default:
          isDefaultActive,

        rule_count:
          isDefaultActive
            ? DEFAULT_RULES_COUNT
            : null,
      },

      question:
        cleanQuestion,

      answer,

      model,
    });
  } catch (error) {
    console.error(
      "ASK RULEBOT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Unable to process RuleBot question",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
}

// ============================================================
// DELETE / RESET RULES
//
// DELETE /api/rulebot/:hackathonId/rules
// ============================================================

export async function deleteRules(
  req,
  res
) {
  try {
    const {
      hackathonId,
    } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const hackathon =
      await getHackathon(
        hackathonId
      );

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message:
          "Hackathon not found",
      });
    }

    if (
      !hasRulesManagementAccess(
        req.user,
        hackathon
      )
    ) {
      return res.status(403).json({
        success: false,

        message:
          "Only the hackathon organizer or admin can reset rules approval",
      });
    }

    await pool.query(
      `
      DELETE FROM hackathon_rules
      WHERE hackathon_id = $1
      `,
      [hackathonId]
    );

    return res.json({
      success: true,

      message:
        "RuleBot approval reset. Default rules are available for approval again.",
    });
  } catch (error) {
    console.error(
      "RESET RULEBOT RULES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Unable to reset RuleBot rules approval",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
}