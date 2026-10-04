import pool from "../config/db.js";

// ============================================================
// GEMINI CONFIGURATION
// ============================================================

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

const DEFAULT_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.6-flash";

// Same fallback order used by ai.service.js
const GEMINI_MODELS = [
  DEFAULT_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
];

const MAX_RETRIES_PER_MODEL = 2;

const RETRY_DELAYS = [2000, 5000];

// ============================================================
// WAIT
// ============================================================

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ============================================================
// RETRYABLE GEMINI STATUS
// ============================================================

function isRetryableStatus(status) {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

// ============================================================
// CALL ONE GEMINI MODEL WITH RETRIES
// ============================================================

async function callGeminiModel(
  prompt,
  model,
  apiKey
) {
  let lastError = null;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES_PER_MODEL;
    attempt++
  ) {
    try {
      console.log(
        `Gemini request: model=${model}, attempt=${
          attempt + 1
        }/${MAX_RETRIES_PER_MODEL + 1}`
      );

      const geminiResponse =
        await fetch(
          `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: prompt,
                    },
                  ],
                },
              ],

              generationConfig: {
                temperature: 0.2,
                responseMimeType:
                  "application/json",
              },
            }),
          }
        );

      // ========================================================
      // GEMINI HTTP ERROR
      // ========================================================

      if (!geminiResponse.ok) {
        const errorText =
          await geminiResponse.text();

        console.error(
          `GEMINI API ERROR [${geminiResponse.status}] using ${model}:`,
          errorText
        );

        if (
          isRetryableStatus(
            geminiResponse.status
          ) &&
          attempt < MAX_RETRIES_PER_MODEL
        ) {
          const delay =
            RETRY_DELAYS[attempt];

          console.log(
            `Temporary Gemini error (${geminiResponse.status}). ` +
              `Retrying ${model} in ${
                delay / 1000
              }s...`
          );

          await sleep(delay);

          continue;
        }

        const error =
          new Error(
            `Gemini API error: ${geminiResponse.status}`
          );

        error.status =
          geminiResponse.status;

        error.model = model;

        error.responseBody =
          errorText;

        throw error;
      }

      // ========================================================
      // SUCCESSFUL GEMINI RESPONSE
      // ========================================================

      const geminiData =
        await geminiResponse.json();

      console.log(
        `GEMINI RESPONSE RECEIVED FROM ${model}`
      );

      const rawText =
        geminiData
          ?.candidates?.[0]
          ?.content?.parts?.[0]
          ?.text;

      if (!rawText) {
        console.error(
          `GEMINI EMPTY RESPONSE FROM ${model}:`,
          JSON.stringify(
            geminiData,
            null,
            2
          )
        );

        throw new Error(
          `Gemini returned no text output from ${model}`
        );
      }

      return {
        rawText,
        model,
      };
    } catch (error) {
      lastError = error;

      const status =
        error?.status;

      const shouldRetry =
        attempt <
          MAX_RETRIES_PER_MODEL &&
        (
          !status ||
          isRetryableStatus(status)
        );

      if (shouldRetry) {
        const delay =
          RETRY_DELAYS[attempt];

        console.log(
          `Gemini request error for ${model}. ` +
            `Retrying in ${
              delay / 1000
            }s...`
        );

        await sleep(delay);

        continue;
      }

      break;
    }
  }

  throw (
    lastError ||
    new Error(
      `Gemini model ${model} failed`
    )
  );
}

// ============================================================
// CALL GEMINI WITH MODEL FALLBACK
// ============================================================

async function callGeminiWithFallback(
  prompt,
  apiKey
) {
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      console.log(
        `Trying Gemini model: ${model}`
      );

      const result =
        await callGeminiModel(
          prompt,
          model,
          apiKey
        );

      console.log(
        `Gemini analysis successful using ${model}`
      );

      return result;
    } catch (error) {
      lastError = error;

      console.error(
        `Gemini model ${model} failed:`,
        error.message
      );

      // Do not switch models for
      // authentication/configuration errors.
      if (
        error.status === 400 ||
        error.status === 401 ||
        error.status === 403
      ) {
        throw error;
      }

      console.log(
        `Switching from ${model} to next Gemini fallback model...`
      );
    }
  }

  throw (
    lastError ||
    new Error(
      "All Gemini models failed"
    )
  );
}

// ============================================================
// HELPER — CHECK ORGANIZER / ADMIN ACCESS
// ============================================================

const checkOrganizerAccess = async (
  hackathonId,
  user
) => {
  const result =
    await pool.query(
      `
      SELECT
        id,
        title,
        organizer_id,
        publication_status,
        current_round
      FROM hackathons
      WHERE id = $1
      LIMIT 1
      `,
      [hackathonId]
    );

  if (
    result.rows.length === 0
  ) {
    return {
      allowed: false,
      status: 404,
      message:
        "Hackathon not found",
    };
  }

  const hackathon =
    result.rows[0];

  if (user.role === "ADMIN") {
    return {
      allowed: true,
      hackathon,
    };
  }

  if (
    user.role !== "ORGANIZER" ||
    hackathon.organizer_id !==
      user.id
  ) {
    return {
      allowed: false,
      status: 403,
      message:
        "You do not have permission to manage this hackathon",
    };
  }

  return {
    allowed: true,
    hackathon,
  };
};

// ============================================================
// GET ROUND 2 SUBMISSIONS
// GET /api/organizer/round2/hackathons/:hackathonId/submissions
// ============================================================

export const getRound2Submissions =
  async (req, res) => {
    try {
      const {
        hackathonId,
      } = req.params;

      // --------------------------------------------------------
      // Check organizer/admin access
      // --------------------------------------------------------

      const access =
        await checkOrganizerAccess(
          hackathonId,
          req.user
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            success: false,
            message:
              access.message,
          });
      }

      const hackathon =
        access.hackathon;

      // --------------------------------------------------------
      // Get Round 2
      // --------------------------------------------------------

      const roundResult =
        await pool.query(
          `
          SELECT
            id,
            round_number,
            title,
            status,
            start_at,
            end_at,
            activated_at,
            activated_by,
            completed_at
          FROM hackathon_rounds
          WHERE hackathon_id = $1
            AND round_number = 2
          LIMIT 1
          `,
          [hackathonId]
        );

      if (
        roundResult.rows.length ===
        0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Round 2 not found",
        });
      }

      const round =
        roundResult.rows[0];

      // --------------------------------------------------------
      // Get submissions + AI analysis + organizer decision
      // --------------------------------------------------------

      const submissionsResult =
        await pool.query(
          `
          SELECT
            rs.id,
            rs.hackathon_id,
            rs.team_id,
            rs.submitted_by,

            rs.github_url,
            rs.pdf_url,
            rs.pdf_file_name,
            rs.pdf_file_path,
            rs.extracted_text,

            rs.status,
            rs.submitted_at,
            rs.created_at,
            rs.updated_at,

            t.name AS team_name,

            u.name AS submitted_by_name,
            u.email AS submitted_by_email,

            ai.id AS ai_analysis_id,
            ai.novelty_score,
            ai.relevance_score,
            ai.innovation_score,
            ai.technical_score,
            ai.impact_score,
            ai.overall_score,
            ai.recommendation,
            ai.feedback AS ai_feedback,
            ai.model_name,
            ai.created_at AS ai_analyzed_at,

            d.id AS decision_id,
            d.decision,
            d.organizer_feedback,
            d.decided_by,
            d.decided_at

          FROM round2_submissions rs

          LEFT JOIN teams t
            ON t.id = rs.team_id

          LEFT JOIN users u
            ON u.id = rs.submitted_by

          LEFT JOIN round2_ai_analysis ai
            ON ai.round2_submission_id = rs.id

          LEFT JOIN round2_decisions d
            ON d.round2_submission_id = rs.id

          WHERE rs.hackathon_id = $1

          ORDER BY
            rs.submitted_at DESC NULLS LAST,
            rs.created_at DESC
          `,
          [hackathonId]
        );

      // --------------------------------------------------------
      // Format submissions
      // --------------------------------------------------------

      const submissions =
        submissionsResult.rows.map(
          (row) => ({
            id: row.id,

            hackathon_id:
              row.hackathon_id,

            team: {
              id: row.team_id,
              name: row.team_name,
            },

            submitted_by: {
              id: row.submitted_by,
              name:
                row.submitted_by_name,
              email:
                row.submitted_by_email,
            },

            github_url:
              row.github_url,

            pdf: {
              url: row.pdf_url,
              file_name:
                row.pdf_file_name,
              file_path:
                row.pdf_file_path,
            },

            extracted_text:
              row.extracted_text,

            status: row.status,

            submitted_at:
              row.submitted_at,
            created_at:
              row.created_at,
            updated_at:
              row.updated_at,

            ai_analysis:
              row.ai_analysis_id
                ? {
                    id:
                      row.ai_analysis_id,

                    novelty_score:
                      row.novelty_score,

                    relevance_score:
                      row.relevance_score,

                    innovation_score:
                      row.innovation_score,

                    technical_score:
                      row.technical_score,

                    impact_score:
                      row.impact_score,

                    overall_score:
                      row.overall_score,

                    recommendation:
                      row.recommendation,

                    feedback:
                      row.ai_feedback,

                    model_name:
                      row.model_name,

                    analyzed_at:
                      row.ai_analyzed_at,
                  }
                : null,

            organizer_decision:
              row.decision_id
                ? {
                    id:
                      row.decision_id,

                    decision:
                      row.decision,

                    feedback:
                      row.organizer_feedback,

                    decided_by:
                      row.decided_by,

                    decided_at:
                      row.decided_at,
                  }
                : null,
          })
        );

      return res.status(200).json({
        success: true,

        hackathon: {
          id: hackathon.id,
          title: hackathon.title,
          publication_status:
            hackathon.publication_status,
          current_round:
            hackathon.current_round,
        },

        round: {
          id: round.id,
          number:
            round.round_number,
          title: round.title,
          status: round.status,
          start_at:
            round.start_at,
          end_at: round.end_at,
          activated_at:
            round.activated_at,
          completed_at:
            round.completed_at,
        },

        count:
          submissions.length,

        submissions,
      });
    } catch (error) {
      console.error(
        "Get Round 2 submissions error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to get Round 2 submissions",
        error: error.message,
      });
    }
  };

// ============================================================
// ANALYZE ROUND 2 SUBMISSION WITH GEMINI
// POST /api/organizer/round2/submissions/:submissionId/analyze
// ============================================================

export const analyzeRound2Submission =
  async (req, res) => {
    try {
      const {
        submissionId,
      } = req.params;

      // --------------------------------------------------------
      // Get submission + hackathon
      // --------------------------------------------------------

      const submissionResult =
        await pool.query(
          `
          SELECT
            rs.id,
            rs.hackathon_id,
            rs.team_id,
            rs.submitted_by,
            rs.github_url,
            rs.pdf_url,
            rs.pdf_file_name,
            rs.extracted_text,
            rs.status,

            h.title AS hackathon_title,
            h.organizer_id,
            h.publication_status,
            h.current_round

          FROM round2_submissions rs

          INNER JOIN hackathons h
            ON h.id = rs.hackathon_id

          WHERE rs.id = $1
          LIMIT 1
          `,
          [submissionId]
        );

      if (
        submissionResult.rows.length ===
        0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Round 2 submission not found",
        });
      }

      const submission =
        submissionResult.rows[0];

      // --------------------------------------------------------
      // Permission
      // --------------------------------------------------------

      if (
        req.user.role !== "ADMIN" &&
        (
          req.user.role !==
            "ORGANIZER" ||
          submission.organizer_id !==
            req.user.id
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to analyze this submission",
        });
      }

      // --------------------------------------------------------
      // Check extracted PDF text
      // --------------------------------------------------------

      if (
        !submission.extracted_text ||
        !submission.extracted_text.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "No extracted PDF text is available for AI analysis",
        });
      }

      // --------------------------------------------------------
      // Gemini configuration
      // --------------------------------------------------------

      const apiKey =
        process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message:
            "GEMINI_API_KEY is not configured",
        });
      }

      // --------------------------------------------------------
      // Mark submission UNDER_REVIEW
      // --------------------------------------------------------

      await pool.query(
        `
        UPDATE round2_submissions
        SET
          status = 'UNDER_REVIEW',
          updated_at = NOW()
        WHERE id = $1
        `,
        [submission.id]
      );

      // --------------------------------------------------------
      // Prepare AI context
      // --------------------------------------------------------

      const githubUrl =
        submission.github_url ||
        "Not provided";

      const pdfText =
        submission.extracted_text.trim();

      const maxCharacters = 30000;

      const limitedPdfText =
        pdfText.length >
        maxCharacters
          ? pdfText.substring(
              0,
              maxCharacters
            ) +
            "\n\n[PDF text truncated for AI analysis]"
          : pdfText;

      const prompt = `
You are an AI evaluation assistant for a student hackathon.

You are analyzing a Round 2 project submission.

Your job is to evaluate the project fairly and provide a recommendation to the human organizer.

IMPORTANT:
- Do NOT make the final winner decision.
- The organizer is the final decision-maker.
- Base the evaluation only on the information provided.
- Do not invent project features.
- If information is missing, mention that clearly.
- Do not evaluate information that is not supplied.

Evaluate these five categories from 0 to 100:

1. Novelty
2. Relevance
3. Innovation
4. Technical Quality
5. Impact

Then calculate an overall score from 0 to 100.

Recommendation must be exactly ONE of:

SELECT
REVIEW
REJECT

Meaning:

SELECT:
The project appears strong and suitable to proceed based on the available information.

REVIEW:
The project has potential, but the organizer should manually inspect it carefully.

REJECT:
The project appears to have major issues based on the available information.

Also provide:
- strengths
- weaknesses
- improvement suggestions
- detailed evaluation feedback

Return ONLY valid JSON.

Required JSON format:

{
  "novelty_score": 0,
  "relevance_score": 0,
  "innovation_score": 0,
  "technical_score": 0,
  "impact_score": 0,
  "overall_score": 0,
  "recommendation": "SELECT",
  "strengths": [],
  "weaknesses": [],
  "suggestions": [],
  "feedback": ""
}

HACKATHON:
${submission.hackathon_title}

GITHUB URL:
${githubUrl}

PROJECT REPORT EXTRACTED FROM PDF:
${limitedPdfText}
`;

      // --------------------------------------------------------
      // Call Gemini with retry + fallback
      // --------------------------------------------------------

      const {
        rawText,
        model,
      } =
        await callGeminiWithFallback(
          prompt,
          apiKey
        );

      // --------------------------------------------------------
      // Parse JSON
      // --------------------------------------------------------

      let analysis;

      try {
        analysis = JSON.parse(
          rawText
            .replace(
              /^```json\s*/i,
              ""
            )
            .replace(
              /\s*```$/i,
              ""
            )
            .trim()
        );
      } catch (parseError) {
        console.error(
          "Gemini JSON parse error:",
          parseError
        );

        await pool.query(
          `
          UPDATE round2_submissions
          SET
            status = 'SUBMITTED',
            updated_at = NOW()
          WHERE id = $1
          `,
          [submission.id]
        );

        return res.status(502).json({
          success: false,
          message:
            "AI returned an invalid JSON response",
        });
      }

      // --------------------------------------------------------
      // Validate scores
      // --------------------------------------------------------

      const scoreFields = [
        "novelty_score",
        "relevance_score",
        "innovation_score",
        "technical_score",
        "impact_score",
        "overall_score",
      ];

      for (const field of scoreFields) {
        const value =
          Number(
            analysis[field]
          );

        if (
          Number.isNaN(value) ||
          value < 0 ||
          value > 100
        ) {
          await pool.query(
            `
            UPDATE round2_submissions
            SET
              status = 'SUBMITTED',
              updated_at = NOW()
            WHERE id = $1
            `,
            [submission.id]
          );

          return res.status(502).json({
            success: false,
            message:
              `AI returned an invalid ${field}`,
            value:
              analysis[field],
          });
        }

        analysis[field] =
          value;
      }

      // --------------------------------------------------------
      // Normalize recommendation
      // --------------------------------------------------------

      const allowedRecommendations =
        [
          "SELECT",
          "REVIEW",
          "REJECT",
        ];

      let recommendation =
        String(
          analysis.recommendation ||
            "REVIEW"
        )
          .trim()
          .toUpperCase();

      if (
        !allowedRecommendations.includes(
          recommendation
        )
      ) {
        recommendation =
          "REVIEW";
      }

      // --------------------------------------------------------
      // Build feedback
      // --------------------------------------------------------

      const feedback = {
        strengths:
          Array.isArray(
            analysis.strengths
          )
            ? analysis.strengths
            : [],

        weaknesses:
          Array.isArray(
            analysis.weaknesses
          )
            ? analysis.weaknesses
            : [],

        suggestions:
          Array.isArray(
            analysis.suggestions
          )
            ? analysis.suggestions
            : [],

        feedback:
          String(
            analysis.feedback || ""
          ),
      };

      // --------------------------------------------------------
      // Save AI analysis
      // --------------------------------------------------------

      const analysisResult =
        await pool.query(
          `
          INSERT INTO round2_ai_analysis (
            round2_submission_id,
            novelty_score,
            relevance_score,
            innovation_score,
            technical_score,
            impact_score,
            overall_score,
            recommendation,
            feedback,
            model_name,
            created_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            NOW()
          )
          ON CONFLICT (round2_submission_id)
          DO UPDATE SET
            novelty_score =
              EXCLUDED.novelty_score,

            relevance_score =
              EXCLUDED.relevance_score,

            innovation_score =
              EXCLUDED.innovation_score,

            technical_score =
              EXCLUDED.technical_score,

            impact_score =
              EXCLUDED.impact_score,

            overall_score =
              EXCLUDED.overall_score,

            recommendation =
              EXCLUDED.recommendation,

            feedback =
              EXCLUDED.feedback,

            model_name =
              EXCLUDED.model_name,

            created_at =
              NOW()

          RETURNING *
          `,
          [
            submission.id,
            analysis.novelty_score,
            analysis.relevance_score,
            analysis.innovation_score,
            analysis.technical_score,
            analysis.impact_score,
            analysis.overall_score,
            recommendation,
            JSON.stringify(
              feedback
            ),
            model,
          ]
        );

      // --------------------------------------------------------
      // Mark submission REVIEWED
      // --------------------------------------------------------

      await pool.query(
        `
        UPDATE round2_submissions
        SET
          status = 'REVIEWED',
          updated_at = NOW()
        WHERE id = $1
        `,
        [submission.id]
      );

      // --------------------------------------------------------
      // Success
      // --------------------------------------------------------

      return res.status(200).json({
        success: true,

        message:
          "Round 2 submission analyzed successfully",

        submission_id:
          submission.id,

        analysis:
          analysisResult.rows[0],
      });
    } catch (error) {
      console.error(
        "Analyze Round 2 submission error:",
        error
      );

      // Restore status if possible
      try {
        if (
          req.params.submissionId
        ) {
          await pool.query(
            `
            UPDATE round2_submissions
            SET
              status = 'SUBMITTED',
              updated_at = NOW()
            WHERE id = $1
              AND status = 'UNDER_REVIEW'
            `,
            [
              req.params
                .submissionId,
            ]
          );
        }
      } catch (statusError) {
        console.error(
          "Failed to restore submission status:",
          statusError
        );
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to analyze Round 2 submission",
        error:
          error.message,
      });
    }
  };

// ============================================================
// ORGANIZER DECISION
// PATCH /api/organizer/round2/submissions/:submissionId/decision
// ============================================================

export const decideRound2Submission =
  async (req, res) => {
    try {
      const {
        submissionId,
      } = req.params;

      const {
        decision,
        feedback,
      } = req.body;

      // --------------------------------------------------------
      // Validate decision
      // --------------------------------------------------------

      const normalizedDecision =
        String(decision || "")
          .trim()
          .toUpperCase();

      if (
        ![
          "SELECTED",
          "REJECTED",
        ].includes(
          normalizedDecision
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Decision must be SELECTED or REJECTED",
        });
      }

      // --------------------------------------------------------
      // Validate feedback
      // --------------------------------------------------------

      const organizerFeedback =
        typeof feedback ===
        "string"
          ? feedback.trim()
          : null;

      // --------------------------------------------------------
      // Get submission
      // --------------------------------------------------------

      const submissionResult =
        await pool.query(
          `
          SELECT
            rs.id,
            rs.hackathon_id,
            rs.team_id,
            rs.status,

            h.organizer_id,
            h.current_round,
            h.title AS hackathon_title

          FROM round2_submissions rs

          INNER JOIN hackathons h
            ON h.id = rs.hackathon_id

          WHERE rs.id = $1
          LIMIT 1
          `,
          [submissionId]
        );

      if (
        submissionResult.rows
          .length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Round 2 submission not found",
        });
      }

      const submission =
        submissionResult.rows[0];

      // --------------------------------------------------------
      // Permission
      // --------------------------------------------------------

      if (
        req.user.role !== "ADMIN" &&
        (
          req.user.role !==
            "ORGANIZER" ||
          submission.organizer_id !==
            req.user.id
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to decide this submission",
        });
      }

      // --------------------------------------------------------
      // Check submission status
      // --------------------------------------------------------

      const allowedStatuses = [
        "SUBMITTED",
        "UNDER_REVIEW",
        "REVIEWED",
      ];

      if (
        !allowedStatuses.includes(
          submission.status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This submission cannot be reviewed in its current state",
          current_status:
            submission.status,
        });
      }

      // --------------------------------------------------------
      // Check whether AI analysis exists
      // --------------------------------------------------------

      const analysisResult =
        await pool.query(
          `
          SELECT
            id,
            recommendation,
            overall_score
          FROM round2_ai_analysis
          WHERE round2_submission_id = $1
          LIMIT 1
          `,
          [submission.id]
        );

      /*
        AI analysis is advisory only.

        Organizer/Admin remains the final decision-maker.

        Therefore we allow a decision even if AI analysis
        has not been generated.
      */

      // --------------------------------------------------------
      // Submission status
      // --------------------------------------------------------

      const submissionStatus =
        normalizedDecision ===
        "REJECTED"
          ? "REJECTED"
          : "REVIEWED";

      // --------------------------------------------------------
      // TEAM STATUS
      // --------------------------------------------------------

      const teamStatus =
        normalizedDecision ===
        "SELECTED"
          ? "FINALIST"
          : "DISQUALIFIED";

      // --------------------------------------------------------
      // Transaction
      // --------------------------------------------------------

      const client =
        await pool.connect();

      try {
        await client.query(
          "BEGIN"
        );

        // ------------------------------------------------------
        // Lock submission
        // ------------------------------------------------------

        const lockedSubmissionResult =
          await client.query(
            `
            SELECT
              id,
              hackathon_id,
              team_id,
              status
            FROM round2_submissions
            WHERE id = $1
            FOR UPDATE
            `,
            [submission.id]
          );

        if (
          lockedSubmissionResult
            .rows.length === 0
        ) {
          throw new Error(
            "Round 2 submission disappeared during transaction"
          );
        }

        const lockedSubmission =
          lockedSubmissionResult
            .rows[0];

        // ------------------------------------------------------
        // Check existing decision
        // ------------------------------------------------------

        const existingDecision =
          await client.query(
            `
            SELECT
              id
            FROM round2_decisions
            WHERE round2_submission_id = $1
            LIMIT 1
            `,
            [submission.id]
          );

        let decisionResult;

        if (
          existingDecision.rows
            .length > 0
        ) {
          // ----------------------------------------------------
          // Update existing decision
          // ----------------------------------------------------

          decisionResult =
            await client.query(
              `
              UPDATE round2_decisions
              SET
                decision = $1,
                decided_by = $2,
                organizer_feedback = $3,
                decided_at = NOW()
              WHERE round2_submission_id = $4
              RETURNING *
              `,
              [
                normalizedDecision,
                req.user.id,
                organizerFeedback,
                submission.id,
              ]
            );
        } else {
          // ----------------------------------------------------
          // Create decision
          // ----------------------------------------------------

          decisionResult =
            await client.query(
              `
              INSERT INTO round2_decisions (
                hackathon_id,
                team_id,
                round2_submission_id,
                decision,
                decided_by,
                organizer_feedback,
                decided_at
              )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                NOW()
              )
              RETURNING *
              `,
              [
                submission.hackathon_id,
                submission.team_id,
                submission.id,
                normalizedDecision,
                req.user.id,
                organizerFeedback,
              ]
            );
        }

        // ------------------------------------------------------
        // Update submission status
        // ------------------------------------------------------

        await client.query(
          `
          UPDATE round2_submissions
          SET
            status = $1,
            updated_at = NOW()
          WHERE id = $2
          `,
          [
            submissionStatus,
            submission.id,
          ]
        );

        // ------------------------------------------------------
        // Update team status
        // ------------------------------------------------------

        await client.query(
          `
          UPDATE teams
          SET
            status = $1,
            updated_at = NOW()
          WHERE id = $2
          `,
          [
            teamStatus,
            submission.team_id,
          ]
        );

        /*
          IMPORTANT:

          We intentionally DO NOT update:

            hackathons.current_round

          Selecting one team for Round 3 must NOT automatically
          move the entire hackathon to Round 3.

          Round 3 activation is handled separately by the
          hackathon round activation endpoint.
        */

        // ------------------------------------------------------
        // Get updated team
        // ------------------------------------------------------

        const updatedTeamResult =
          await client.query(
            `
            SELECT
              id,
              name,
              status
            FROM teams
            WHERE id = $1
            LIMIT 1
            `,
            [submission.team_id]
          );

        const updatedTeam =
          updatedTeamResult.rows[0] ||
          null;

        // ------------------------------------------------------
        // COMMIT
        // ------------------------------------------------------

        await client.query(
          "COMMIT"
        );

        // ------------------------------------------------------
        // Success
        // ------------------------------------------------------

        return res.status(200).json({
          success: true,

          message:
            normalizedDecision ===
            "SELECTED"
              ? "Round 2 submission selected successfully."
              : "Round 2 submission rejected successfully.",

          decision:
            normalizedDecision,

          submission: {
            id: submission.id,

            status:
              submissionStatus,

            team_id:
              submission.team_id,

            hackathon_id:
              submission.hackathon_id,

            decision:
              normalizedDecision,
          },

          team: updatedTeam
            ? {
                id:
                  updatedTeam.id,

                name:
                  updatedTeam.name,

                status:
                  updatedTeam.status,
              }
            : {
                id:
                  submission.team_id,

                status:
                  teamStatus,
              },

          organizer_feedback:
            organizerFeedback,

          ai_analysis_available:
            analysisResult.rows
              .length > 0,

          decision_record:
            decisionResult.rows[0],
        });
      } catch (transactionError) {
        await client.query(
          "ROLLBACK"
        );

        throw transactionError;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(
        "Decide Round 2 submission error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to decide Round 2 submission",

        error:
          error.message,
      });
    }
  };