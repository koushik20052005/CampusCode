import pool from "../config/db.js";
import fs from "fs";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";
import { PDFParse } from "pdf-parse";

import {
  analyzeRound2ProjectWithAI,
} from "../services/ai.service.js";
// ============================================================
// HELPERS
// ============================================================
// ============================================================
// BACKGROUND ROUND 2 AI ANALYSIS
//
// PDF extraction remains synchronous because the extracted
// content is required for the submission.
//
// Gemini itself starts only AFTER the database submission
// has been successfully created.
// ============================================================

function startRound2AIAnalysis({
  submission,
  hackathon,
}) {
  setImmediate(async () => {
    try {
      console.log(
        `Round 2 automatic AI analysis started: submission=${submission.id}`
      );

      const analysis =
        await analyzeRound2ProjectWithAI({
          hackathon_title:
            hackathon.title,

          github_url:
            submission.github_url,

          pdf_text:
            submission.extracted_text,
        });

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
        `,
        [
          submission.id,

          analysis.novelty_score,

          analysis.relevance_score,

          analysis.innovation_score,

          analysis.technical_score,

          analysis.impact_score,

          analysis.overall_score,

          analysis.recommendation,

          JSON.stringify(
            feedback
          ),

          analysis.model_name,
        ]
      );

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

      console.log(
        `Round 2 automatic AI analysis completed: submission=${submission.id}, model=${analysis.model_name}`
      );
    } catch (error) {
      console.error(
        `Round 2 automatic AI analysis failed: submission=${submission.id}`,
        error
      );

      /*
       * Keep the submission available for
       * organizer manual Analyze / Re-analyze.
       */
      try {
        await pool.query(
          `
          UPDATE round2_submissions
          SET
            status = 'SUBMITTED',
            updated_at = NOW()
          WHERE id = $1
            AND status <> 'REVIEWED'
          `,
          [submission.id]
        );
      } catch (statusError) {
        console.error(
          `Failed to restore Round 2 submission status: submission=${submission.id}`,
          statusError
        );
      }
    }
  });
}
const normalizeText = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

// ============================================================
// EXTRACT GOOGLE DRIVE FILE ID
// ============================================================

const extractGoogleDriveFileId = (url) => {
  if (typeof url !== "string") {
    return null;
  }

  const value = url.trim();

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/uc\?id=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
};

// ============================================================
// GOOGLE DRIVE URL VALIDATION
// ============================================================

const isGoogleDriveUrl = (url) => {
  if (typeof url !== "string") {
    return false;
  }

  try {
    const parsed = new URL(url);

    const hostname = parsed.hostname.toLowerCase();

    return (
      hostname === "drive.google.com" ||
      hostname === "www.drive.google.com" ||
      hostname === "docs.google.com"
    );
  } catch {
    return false;
  }
};

// ============================================================
// DOWNLOAD GOOGLE DRIVE PDF
// ============================================================

const downloadGoogleDrivePdf = async (driveUrl) => {
  const fileId = extractGoogleDriveFileId(driveUrl);

  if (!fileId) {
    throw new Error(
      "Invalid Google Drive URL. Please provide a valid Google Drive file link."
    );
  }

  const downloadUrl =
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(
      fileId
    )}&export=download&confirm=t`;

  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "campuscode-round2-")
  );

  const tempPath = path.join(
    tempDir,
    `${fileId}.pdf`
  );

  try {
    const response = await fetch(downloadUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Google Drive download failed with status ${response.status}.`
      );
    }

    const contentType = String(
      response.headers.get("content-type") || ""
    ).toLowerCase();

    const contentLength = Number(
      response.headers.get("content-length") || 0
    );

    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    if (contentLength > MAX_FILE_SIZE) {
      throw new Error(
        "PDF file is too large. Maximum allowed size is 10 MB."
      );
    }

    if (!response.body) {
      throw new Error(
        "Google Drive returned an empty response."
      );
    }

    await pipeline(
      response.body,
      fs.createWriteStream(tempPath)
    );

    const stats = await fs.promises.stat(
      tempPath
    );

    if (!stats.size) {
      throw new Error(
        "The downloaded PDF is empty."
      );
    }

    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(
        "PDF file is too large. Maximum allowed size is 10 MB."
      );
    }

    // --------------------------------------------------------
    // VERIFY PDF HEADER
    // --------------------------------------------------------

    const headerBuffer = Buffer.alloc(5);

    const fileHandle =
      await fs.promises.open(
        tempPath,
        "r"
      );

    try {
      await fileHandle.read(
        headerBuffer,
        0,
        5,
        0
      );
    } finally {
      await fileHandle.close();
    }

    const header =
      headerBuffer.toString("ascii");

    if (header !== "%PDF-") {
      const firstBytes =
        await fs.promises.readFile(
          tempPath,
          {
            encoding: "utf8",
          }
        );

      const lowerContent =
        firstBytes
          .slice(0, 1000)
          .toLowerCase();

      if (
        contentType.includes("text/html") ||
        lowerContent.includes("<html") ||
        lowerContent.includes("<!doctype")
      ) {
        throw new Error(
          "Google Drive returned an HTML page instead of the PDF. Make sure the file is shared as 'Anyone with the link' and the link points directly to the PDF."
        );
      }

      throw new Error(
        "The Google Drive file is not a valid PDF. Please check the uploaded file."
      );
    }

    return {
      tempDir,
      tempPath,
      fileSize: stats.size,
    };
  } catch (error) {
    try {
      await fs.promises.rm(
        tempDir,
        {
          recursive: true,
          force: true,
        }
      );
    } catch {
      // Ignore cleanup errors.
    }

    throw error;
  }
};

// ============================================================
// EXTRACT PDF TEXT
// ============================================================

const extractPdfText = async (
  filePath
) => {
  let parser = null;

  try {
    const pdfBuffer =
      await fs.promises.readFile(
        filePath
      );

    if (!pdfBuffer.length) {
      throw new Error(
        "The PDF file is empty."
      );
    }

    if (
      pdfBuffer
        .subarray(0, 5)
        .toString("ascii") !== "%PDF-"
    ) {
      throw new Error(
        "The downloaded file is not a valid PDF."
      );
    }

    parser = new PDFParse({
      data: pdfBuffer,
    });

    const result =
      await parser.getText();

    const text = normalizeText(
      result?.text || ""
    );

    if (!text) {
      throw new Error(
        "The PDF was downloaded, but its text could not be extracted. Please upload a readable text-based PDF."
      );
    }

    return text;
  } catch (error) {
    if (
      error?.message ===
      "The PDF was downloaded, but its text could not be extracted. Please upload a readable text-based PDF."
    ) {
      throw error;
    }

    console.error(
      "Round 2 PDF extraction error:",
      error
    );

    throw new Error(
      "The PDF was downloaded, but its text could not be extracted. Please upload a readable text-based PDF."
    );
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch (destroyError) {
        console.error(
          "Round 2 PDF parser cleanup error:",
          destroyError?.message ||
            destroyError
        );
      }
    }
  }
};

// ============================================================
// GET ROUND 2 STATUS
//
// GET /api/student/round2/hackathons/:hackathonId
// ============================================================

export const getRound2Status = async (
  req,
  res
) => {
  try {
    const studentId =
      req.user?.id ||
      req.user?.user_id;

    const { hackathonId } =
      req.params;

    // --------------------------------------------------------
    // AUTH CHECK
    // --------------------------------------------------------

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message:
          "Hackathon ID is required",
      });
    }

    // --------------------------------------------------------
    // CHECK REGISTRATION
    // --------------------------------------------------------

    const registrationResult =
      await pool.query(
        `
        SELECT
          hp.id,
          hp.hackathon_id,
          hp.user_id,
          hp.status
        FROM hackathon_participants hp
        WHERE hp.hackathon_id = $1
          AND hp.user_id = $2
        LIMIT 1
        `,
        [
          hackathonId,
          studentId,
        ]
      );

    if (
      registrationResult.rows.length ===
      0
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not registered for this hackathon.",
      });
    }

    // --------------------------------------------------------
    // GET HACKATHON
    // --------------------------------------------------------

    const hackathonResult =
      await pool.query(
        `
        SELECT
          id,
          title,
          description,
          current_round,
          status,
          start_date,
          end_date
        FROM hackathons
        WHERE id = $1
        LIMIT 1
        `,
        [hackathonId]
      );

    if (
      hackathonResult.rows.length ===
      0
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Hackathon not found.",
      });
    }

    const hackathon =
      hackathonResult.rows[0];

    // --------------------------------------------------------
    // GET STUDENT TEAM
    //
    // IMPORTANT:
    // Do NOT use t.team_code.
    // That column does not exist.
    // --------------------------------------------------------

    const teamResult =
      await pool.query(
        `
        SELECT
          t.id,
          t.name,
          t.status,
          t.leader_id
        FROM team_members tm
        INNER JOIN teams t
          ON t.id = tm.team_id
        WHERE tm.user_id = $1
          AND t.hackathon_id = $2
        LIMIT 1
        `,
        [
          studentId,
          hackathonId,
        ]
      );

    const team =
      teamResult.rows[0] || null;

    // --------------------------------------------------------
    // GET ROUND 1 DECISION
    //
    // IMPORTANT:
    // round1_decisions uses:
    // decision
    // organizer_feedback
    // decided_by
    // decided_at
    //
    // No score.
    // No reviewed_at.
    // --------------------------------------------------------

    let round1Decision = null;

    if (team) {
      const round1DecisionResult =
        await pool.query(
          `
          SELECT
            decision,
            organizer_feedback,
            decided_by,
            decided_at
          FROM round1_decisions
          WHERE hackathon_id = $1
            AND team_id = $2
          ORDER BY decided_at DESC NULLS LAST
          LIMIT 1
          `,
          [
            hackathonId,
            team.id,
          ]
        );

      round1Decision =
        round1DecisionResult
          .rows[0] || null;
    }

    // --------------------------------------------------------
    // ROUND 1 DECISION NOT AVAILABLE
    // --------------------------------------------------------

    if (!round1Decision) {
      return res.json({
        success: true,
        accessible: false,
        message:
          "Round 1 decision is not available yet.",
        hackathon,
        team,
        decision: null,
        submission: null,
        round_status: "LOCKED",
      });
    }

    // --------------------------------------------------------
    // CHECK ROUND 1 DECISION
    // --------------------------------------------------------

    const normalizedRound1Decision =
      String(
        round1Decision.decision ||
          ""
      ).toUpperCase();

    if (
      normalizedRound1Decision !==
      "SELECTED"
    ) {
      return res.json({
        success: true,
        accessible: false,
        message:
          "Your team was not selected for Round 2.",
        hackathon,
        team,
        decision:
          round1Decision,
        submission: null,
        round_status: "LOCKED",
      });
    }

    // --------------------------------------------------------
    // GET ROUND 2 SUBMISSION
    // --------------------------------------------------------

    const submissionResult =
      await pool.query(
        `
        SELECT
          id,
          hackathon_id,
          team_id,
          submitted_by,
          github_url,
          pdf_url,
          extracted_text,
          status,
          submitted_at,
          updated_at
        FROM round2_submissions
        WHERE hackathon_id = $1
          AND team_id = $2
        ORDER BY submitted_at DESC
        LIMIT 1
        `,
        [
          hackathonId,
          team.id,
        ]
      );

    const submission =
      submissionResult.rows[0] ||
      null;

    // --------------------------------------------------------
    // GET ROUND 2 DECISION
    //
    // IMPORTANT:
    // round2_decisions uses:
    // decision
    // organizer_feedback
    // decided_by
    // decided_at
    //
    // We alias decided_by / decided_at
    // so the frontend can continue receiving:
    // reviewed_by / reviewed_at
    //
    // NO score column.
    // --------------------------------------------------------

    const decisionResult =
      await pool.query(
        `
        SELECT
          id,
          hackathon_id,
          team_id,
          decision,
          organizer_feedback,
          decided_by AS reviewed_by,
          decided_at AS reviewed_at
        FROM round2_decisions
        WHERE hackathon_id = $1
          AND team_id = $2
        ORDER BY decided_at DESC NULLS LAST
        LIMIT 1
        `,
        [
          hackathonId,
          team.id,
        ]
      );

    const round2Decision =
      decisionResult.rows[0] ||
      null;

    // --------------------------------------------------------
    // CHECK CURRENT ROUND
    // --------------------------------------------------------

    const currentRound = Number(
      hackathon.current_round || 0
    );

    const accessible =
      currentRound >= 2;

    let message =
      "Round 2 is locked.";

    if (accessible) {
      message = submission
        ? "Round 2 submission found."
        : "Round 2 is open.";
    }

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.json({
      success: true,
      accessible,
      message,
      hackathon,
      team,

      // Round 2 decision if available,
      // otherwise Round 1 decision.
      decision:
        round2Decision ||
        round1Decision,

      round1_decision:
        round1Decision,

      submission,

      round_status:
        accessible
          ? "OPEN"
          : "LOCKED",

      current_round:
        currentRound,
    });
  } catch (error) {
    console.error(
      "getRound2Status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch Round 2 status.",
      error:
        process.env.NODE_ENV ===
        "development"
          ? error?.message
          : undefined,
    });
  }
};

// ============================================================
// SUBMIT ROUND 2
//
// POST /api/student/round2/hackathons/:hackathonId/submit
// ============================================================

export const submitRound2 = async (
  req,
  res
) => {
  let tempDir = null;

  try {
    const studentId =
      req.user?.id ||
      req.user?.user_id;

    const { hackathonId } =
      req.params;

    // --------------------------------------------------------
    // INPUT
    //
    // GitHub = OPTIONAL
    // PDF = REQUIRED
    // --------------------------------------------------------

    const githubUrl =
      typeof req.body?.github_url ===
      "string"
        ? req.body.github_url.trim()
        : "";

    const pdfUrl =
      typeof req.body?.pdf_url ===
      "string"
        ? req.body.pdf_url.trim()
        : "";

    // --------------------------------------------------------
    // AUTH
    // --------------------------------------------------------

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message:
          "Hackathon ID is required.",
      });
    }

    // --------------------------------------------------------
    // PDF REQUIRED
    // --------------------------------------------------------

    if (!pdfUrl) {
      return res.status(400).json({
        success: false,
        message:
          "Google Drive PDF URL is required.",
      });
    }

    // --------------------------------------------------------
    // GOOGLE DRIVE URL
    // --------------------------------------------------------

    if (!isGoogleDriveUrl(pdfUrl)) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid Google Drive PDF URL.",
      });
    }

    // --------------------------------------------------------
    // CHECK REGISTRATION
    // --------------------------------------------------------

    const registrationResult =
      await pool.query(
        `
        SELECT
          id,
          hackathon_id,
          user_id,
          status
        FROM hackathon_participants
        WHERE hackathon_id = $1
          AND user_id = $2
        LIMIT 1
        `,
        [
          hackathonId,
          studentId,
        ]
      );

    if (
      registrationResult.rows.length ===
      0
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not registered for this hackathon.",
      });
    }

    // --------------------------------------------------------
    // GET HACKATHON
    // --------------------------------------------------------

    const hackathonResult =
      await pool.query(
        `
        SELECT
          id,
          title,
          description,
          current_round,
          status,
          start_date,
          end_date
        FROM hackathons
        WHERE id = $1
        LIMIT 1
        `,
        [hackathonId]
      );

    if (
      hackathonResult.rows.length ===
      0
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Hackathon not found.",
      });
    }

    const hackathon =
      hackathonResult.rows[0];

    // --------------------------------------------------------
    // ROUND 2 MUST BE ACTIVE
    // --------------------------------------------------------

    const currentRound = Number(
      hackathon.current_round || 0
    );

    if (currentRound !== 2) {
      return res.status(400).json({
        success: false,
        message:
          currentRound < 2
            ? "Round 2 is not active yet."
            : "Round 2 submission is closed.",
      });
    }

    // --------------------------------------------------------
    // GET STUDENT TEAM
    //
    // IMPORTANT:
    // team_code removed.
    // --------------------------------------------------------

    const teamResult =
      await pool.query(
        `
        SELECT
          t.id,
          t.name,
          t.status,
          t.leader_id
        FROM team_members tm
        INNER JOIN teams t
          ON t.id = tm.team_id
        WHERE tm.user_id = $1
          AND t.hackathon_id = $2
        LIMIT 1
        `,
        [
          studentId,
          hackathonId,
        ]
      );

    if (
      teamResult.rows.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You must be part of a team before submitting Round 2.",
      });
    }

    const team =
      teamResult.rows[0];

    // --------------------------------------------------------
    // GET ROUND 1 DECISION
    //
    // No score.
    // No reviewed_at.
    // --------------------------------------------------------

    const round1DecisionResult =
      await pool.query(
        `
        SELECT
          decision,
          organizer_feedback,
          decided_by,
          decided_at
        FROM round1_decisions
        WHERE hackathon_id = $1
          AND team_id = $2
        ORDER BY decided_at DESC NULLS LAST
        LIMIT 1
        `,
        [
          hackathonId,
          team.id,
        ]
      );

    if (
      round1DecisionResult.rows
        .length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Round 1 decision is not available yet.",
      });
    }

    const round1Decision =
      round1DecisionResult
        .rows[0];

    // --------------------------------------------------------
    // ROUND 1 MUST BE SELECTED
    // --------------------------------------------------------

    const normalizedDecision =
      String(
        round1Decision.decision ||
          ""
      ).toUpperCase();

    if (
      normalizedDecision !==
      "SELECTED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your team must be selected in Round 1 before submitting Round 2.",
      });
    }

    // --------------------------------------------------------
    // CHECK EXISTING SUBMISSION
    // --------------------------------------------------------

    const existingSubmissionResult =
      await pool.query(
        `
        SELECT
          id,
          hackathon_id,
          team_id,
          submitted_by,
          github_url,
          pdf_url,
          extracted_text,
          status,
          submitted_at,
          updated_at
        FROM round2_submissions
        WHERE hackathon_id = $1
          AND team_id = $2
        LIMIT 1
        `,
        [
          hackathonId,
          team.id,
        ]
      );

    if (
      existingSubmissionResult
        .rows.length > 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Your team has already submitted Round 2.",
        submission:
          existingSubmissionResult
            .rows[0],
      });
    }

    // --------------------------------------------------------
    // DOWNLOAD PDF
    // --------------------------------------------------------

    console.log(
      `Round 2 PDF download started: hackathon=${hackathonId}, team=${team.id}`
    );

    const downloaded =
      await downloadGoogleDrivePdf(
        pdfUrl
      );

    tempDir =
      downloaded.tempDir;

    console.log(
      `Round 2 PDF downloaded successfully: ${downloaded.fileSize} bytes`
    );

    // --------------------------------------------------------
    // EXTRACT PDF TEXT
    // --------------------------------------------------------

    console.log(
      "Round 2 PDF text extraction started..."
    );

    const extractedText =
      await extractPdfText(
        downloaded.tempPath
      );

    console.log(
      `Round 2 PDF text extraction successful: ${extractedText.length} characters`
    );

    if (
      !extractedText ||
      extractedText.trim().length < 20
    ) {
      throw new Error(
        "The PDF was downloaded, but its text could not be extracted. Please upload a readable text-based PDF."
      );
    }

    // --------------------------------------------------------
    // INSERT ROUND 2 SUBMISSION
    // --------------------------------------------------------

    const insertResult =
      await pool.query(
        `
        INSERT INTO round2_submissions (
          hackathon_id,
          team_id,
          submitted_by,
          github_url,
          pdf_url,
          extracted_text,
          status,
          submitted_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          'SUBMITTED',
          NOW(),
          NOW()
        )
        RETURNING
          id,
          hackathon_id,
          team_id,
          submitted_by,
          github_url,
          pdf_url,
          extracted_text,
          status,
          submitted_at,
          updated_at
        `,
        [
          hackathonId,
          team.id,
          studentId,
          githubUrl || null,
          pdfUrl,
          extractedText,
        ]
      );

    const submission =
      insertResult.rows[0];
    // --------------------------------------------------------
// START GEMINI IN BACKGROUND
// --------------------------------------------------------

startRound2AIAnalysis({
  submission,
  hackathon,
});
    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    return res.status(201).json({
      success: true,
      message:
        "Round 2 project submitted successfully.",
      submission,
    });
  } catch (error) {
    console.error(
      "submitRound2 error:",
      error
    );

    // --------------------------------------------------------
    // DUPLICATE SUBMISSION
    // --------------------------------------------------------

    if (error?.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "Your team has already submitted Round 2.",
      });
    }

    // --------------------------------------------------------
    // PDF EXTRACTION ERROR
    // --------------------------------------------------------

    if (
      error?.message ===
      "The PDF was downloaded, but its text could not be extracted. Please upload a readable text-based PDF."
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // --------------------------------------------------------
    // GOOGLE DRIVE / PDF ERROR
    // --------------------------------------------------------

    if (
      error?.message?.includes(
        "Google Drive"
      ) ||
      error?.message?.includes(
        "valid PDF"
      ) ||
      error?.message?.includes(
        "PDF file is too large"
      )
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // --------------------------------------------------------
    // GENERAL ERROR
    // --------------------------------------------------------

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit Round 2.",
      error:
        process.env.NODE_ENV ===
        "development"
          ? error?.message
          : undefined,
    });
  } finally {
    // --------------------------------------------------------
    // CLEAN TEMP FILES
    // --------------------------------------------------------

    if (tempDir) {
      try {
        await fs.promises.rm(
          tempDir,
          {
            recursive: true,
            force: true,
          }
        );
      } catch (cleanupError) {
        console.error(
          "Round 2 temporary file cleanup error:",
          cleanupError?.message ||
            cleanupError
        );
      }
    }
  }
};