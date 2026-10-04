/* =========================================================
   AI ANALYSIS WORKER — automatic R1/R2 scoring

   Flow:
   1. Student submits R1/R2  ->  enqueueAnalysisJob() creates
      a PENDING row in ai_analysis_jobs (idempotent per
      team+round).
   2. startAiAnalysisWorker() runs an in-process loop (no
      Redis needed) that claims one PENDING job at a time
      with SELECT ... FOR UPDATE SKIP LOCKED, marks it
      PROCESSING, calls Gemini, and stores the result in the
      same columns/tables the manual "Analyze" buttons use.
   3. Failed jobs retry with backoff up to max_attempts.
   4. recoverStaleJobs() runs at boot: any job left in
      PROCESSING (e.g. server restarted mid-analysis) goes
      back to PENDING.

   UI states: PENDING -> PROCESSING -> COMPLETED | FAILED
========================================================= */

import pool from "../config/db.js";
import {
  analyzeProjectWithAI,
  analyzeRound2ProjectWithAI,
} from "./ai.service.js";

const POLL_INTERVAL_MS =
  Number(process.env.AI_WORKER_POLL_MS) || 5000;

const STALE_LOCK_MINUTES =
  Number(process.env.AI_WORKER_STALE_MINUTES) || 10;

const MAX_ATTEMPTS = 3;

/* =========================================================
   ENQUEUE — called right after a student R1/R2 submit.
   Idempotent: one pipeline per (hackathon, team, round).
========================================================= */

export async function enqueueAnalysisJob({
  hackathonId,
  teamId,
  round,
  submissionId,
}) {
  if (!hackathonId || !teamId || ![1, 2].includes(round) || !submissionId) {
    throw new Error("enqueueAnalysisJob: invalid job parameters");
  }

  const result = await pool.query(
    `
    INSERT INTO ai_analysis_jobs (
      hackathon_id, team_id, round, submission_id,
      status, attempts, updated_at
    )
    VALUES ($1, $2, $3, $4, 'PENDING', 0, NOW())
    ON CONFLICT (hackathon_id, team_id, round)
    DO UPDATE SET
      submission_id = EXCLUDED.submission_id,
      status = 'PENDING',
      attempts = 0,
      error = NULL,
      result = NULL,
      locked_at = NULL,
      updated_at = NOW()
    RETURNING id, status
    `,
    [hackathonId, teamId, round, submissionId]
  );

  return result.rows[0];
}

/* =========================================================
   STATUS — for student/organizer polling
========================================================= */

export async function getTeamJobStatus(hackathonId, teamId) {
  const result = await pool.query(
    `
    SELECT
      round, status, attempts, max_attempts,
      result, error, updated_at, created_at
    FROM ai_analysis_jobs
    WHERE hackathon_id = $1 AND team_id = $2
    ORDER BY round ASC
    `,
    [hackathonId, teamId]
  );
  return result.rows;
}

/* =========================================================
   RECOVER STALE LOCKS (boot)
========================================================= */

export async function recoverStaleJobs() {
  try {
    const result = await pool.query(
      `
      UPDATE ai_analysis_jobs
      SET status = 'PENDING',
          locked_at = NULL,
          updated_at = NOW()
      WHERE status = 'PROCESSING'
        AND locked_at < NOW() - ($1 || ' minutes')::interval
      `,
      [String(STALE_LOCK_MINUTES)]
    );
    if (result.rowCount > 0) {
      console.log(
        `🤖 AI worker: recovered ${result.rowCount} stale job(s) to PENDING`
      );
    }
  } catch (error) {
    console.error(
      "🤖 AI worker: stale-job recovery failed:",
      error?.message || error
    );
  }
}

/* =========================================================
   CLAIM — one job at a time, skip locked rows
========================================================= */

async function claimNextJob(client) {
  const result = await client.query(
    `
    SELECT *
    FROM ai_analysis_jobs
    WHERE status = 'PENDING'
       OR (status = 'FAILED' AND attempts < max_attempts
           AND updated_at < NOW() - (POWER(2, attempts) || ' minutes')::interval)
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
    `
  );
  if (result.rows.length === 0) return null;

  const job = result.rows[0];
  await client.query(
    `
    UPDATE ai_analysis_jobs
    SET status = 'PROCESSING',
        attempts = attempts + 1,
        locked_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    `,
    [job.id]
  );
  return { ...job, attempts: job.attempts + 1 };
}

async function finishJob(client, jobId, { status, result = null, error = null }) {
  await client.query(
    `
    UPDATE ai_analysis_jobs
    SET status = $2,
        result = COALESCE($3, result),
        error = $4,
        locked_at = NULL,
        updated_at = NOW()
    WHERE id = $1
    `,
    [jobId, status, result ? JSON.stringify(result) : null, error]
  );
}

/* =========================================================
   ROUND 1 ANALYSIS  (mirrors organizer "Analyze" flow)
========================================================= */

function computeOverallScore(analysis) {
  let overall = analysis.overall_score;
  if (overall === null || overall === undefined) {
    const scores = [
      analysis.novelty_score,
      analysis.relevance_score,
      analysis.innovation_score,
      analysis.technical_score,
      analysis.impact_score,
    ]
      .map(Number)
      .filter((v) => Number.isFinite(v));
    if (scores.length > 0) {
      overall = scores.reduce((a, b) => a + b, 0) / scores.length;
    }
  }
  return overall === null || overall === undefined
    ? null
    : Number(Number(overall).toFixed(2));
}

async function analyzeRound1(client, job) {
  const sub = await client.query(
    `
    SELECT
      r1.id, r1.hackathon_id, r1.team_id,
      r1.problem_statement, r1.status,
      h.title AS hackathon_title,
      h.description AS hackathon_description,
      t.name AS team_name
    FROM round1_submissions r1
    INNER JOIN hackathons h ON h.id = r1.hackathon_id
    INNER JOIN teams t ON t.id = r1.team_id
    WHERE r1.id = $1
    LIMIT 1
    `,
    [job.submission_id]
  );
  if (sub.rows.length === 0) {
    throw new Error("Round 1 submission not found");
  }
  const s = sub.rows[0];
  if (s.status === "DRAFT") {
    throw new Error("Draft submissions cannot be analyzed");
  }

  const analysis = await analyzeProjectWithAI({
    submission_id: s.id,
    submission_status: s.status,
    project_id: s.id,
    title: s.team_name || `Round 1 Submission - ${s.id}`,
    track: "ROUND_1",
    problem_statement: s.problem_statement,
    solution: s.problem_statement,
    technologies: "Not specified in Round 1",
    github_url: null,
    live_demo_url: null,
    team_id: s.team_id,
    team_name: s.team_name,
    hackathon_id: s.hackathon_id,
    hackathon_title: s.hackathon_title,
    hackathon_description: s.hackathon_description,
  });
  if (!analysis) throw new Error("Gemini AI returned no analysis");

  const overallScore = computeOverallScore(analysis);

  await client.query(
    `
    UPDATE round1_submissions
    SET ai_score = $1,
        ai_feedback = $2,
        ai_recommendation = $3,
        ai_analyzed_at = NOW(),
        updated_at = NOW()
    WHERE id = $4
    `,
    [
      overallScore,
      analysis.feedback || null,
      analysis.recommendation || "REVIEW",
      s.id,
    ]
  );

  return {
    overall_score: overallScore,
    novelty_score: analysis.novelty_score ?? null,
    relevance_score: analysis.relevance_score ?? null,
    innovation_score: analysis.innovation_score ?? null,
    technical_score: analysis.technical_score ?? null,
    impact_score: analysis.impact_score ?? null,
    recommendation: analysis.recommendation || "REVIEW",
    model_name: analysis.model_name || "Gemini",
  };
}

/* =========================================================
   ROUND 2 ANALYSIS  (mirrors organizer "Analyze" flow)
========================================================= */

async function analyzeRound2(client, job) {
  const sub = await client.query(
    `
    SELECT
      rs.id, rs.hackathon_id, rs.team_id,
      rs.github_url, rs.extracted_text, rs.status,
      h.title AS hackathon_title
    FROM round2_submissions rs
    INNER JOIN hackathons h ON h.id = rs.hackathon_id
    WHERE rs.id = $1
    LIMIT 1
    `,
    [job.submission_id]
  );
  if (sub.rows.length === 0) {
    throw new Error("Round 2 submission not found");
  }
  const s = sub.rows[0];
  if (s.status === "DRAFT") {
    throw new Error("Draft submissions cannot be analyzed");
  }

  const analysis = await analyzeRound2ProjectWithAI({
    hackathon_title: s.hackathon_title,
    github_url: s.github_url,
    pdf_text: s.extracted_text || "",
  });
  if (!analysis) throw new Error("Gemini AI returned no analysis");

  const allowed = ["SELECT", "REJECT", "REVIEW"];
  let recommendation = String(analysis.recommendation || "REVIEW")
    .trim()
    .toUpperCase();
  if (!allowed.includes(recommendation)) recommendation = "REVIEW";

  const feedback = {
    strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
    weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
    suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
    feedback: String(analysis.feedback || ""),
  };

  await client.query(
    `
    INSERT INTO round2_ai_analysis (
      round2_submission_id,
      novelty_score, relevance_score, innovation_score,
      technical_score, impact_score, overall_score,
      recommendation, feedback, model_name, created_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
    ON CONFLICT (round2_submission_id)
    DO UPDATE SET
      novelty_score = EXCLUDED.novelty_score,
      relevance_score = EXCLUDED.relevance_score,
      innovation_score = EXCLUDED.innovation_score,
      technical_score = EXCLUDED.technical_score,
      impact_score = EXCLUDED.impact_score,
      overall_score = EXCLUDED.overall_score,
      recommendation = EXCLUDED.recommendation,
      feedback = EXCLUDED.feedback,
      model_name = EXCLUDED.model_name,
      created_at = NOW()
    `,
    [
      s.id,
      analysis.novelty_score ?? null,
      analysis.relevance_score ?? null,
      analysis.innovation_score ?? null,
      analysis.technical_score ?? null,
      analysis.impact_score ?? null,
      analysis.overall_score ?? null,
      recommendation,
      JSON.stringify(feedback),
      analysis.model_name || "Gemini",
    ]
  );

  return {
    overall_score: analysis.overall_score ?? null,
    recommendation,
    model_name: analysis.model_name || "Gemini",
  };
}

/* =========================================================
   PROCESS ONE JOB
========================================================= */

async function processJob(job) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const claimed = await claimNextJob(client);
    await client.query("COMMIT");
    if (!claimed) return false;

    console.log(
      `🤖 AI worker: analyzing R${claimed.round} (team ${claimed.team_id}, attempt ${claimed.attempts})`
    );

    try {
      const result =
        claimed.round === 1
          ? await analyzeRound1(client, claimed)
          : await analyzeRound2(client, claimed);

      const fin = await pool.connect();
      try {
        await finishJob(fin, claimed.id, { status: "COMPLETED", result });
      } finally {
        fin.release();
      }
      console.log(`🤖 AI worker: R${claimed.round} job ${claimed.id} COMPLETED`);
    } catch (jobError) {
      const fin = await pool.connect();
      try {
        const failed =
          claimed.attempts >= (claimed.max_attempts || MAX_ATTEMPTS);
        await finishJob(fin, claimed.id, {
          status: failed ? "FAILED" : "PENDING",
          error: jobError?.message || "Unknown analysis error",
        });
        console.error(
          `🤖 AI worker: R${claimed.round} job ${claimed.id} error (attempt ${claimed.attempts}):`,
          jobError?.message || jobError
        );
      } finally {
        fin.release();
      }
    }
    return true;
  } finally {
    client.release();
  }
}

/* =========================================================
   WORKER LOOP
========================================================= */

let workerTimer = null;
let workerRunning = false;

export function startAiAnalysisWorker() {
  if (workerTimer) return; // already running

  recoverStaleJobs();

  const tick = async () => {
    if (workerRunning) return; // one job at a time
    workerRunning = true;
    try {
      await processJob();
    } catch (error) {
      console.error("🤖 AI worker tick failed:", error?.message || error);
    } finally {
      workerRunning = false;
    }
  };

  workerTimer = setInterval(tick, POLL_INTERVAL_MS);
  if (typeof workerTimer.unref === "function") workerTimer.unref();
  console.log(
    `🤖 AI analysis worker started (poll every ${POLL_INTERVAL_MS}ms)`
  );

  // Kick off immediately instead of waiting for the first interval
  tick();
}

export function stopAiAnalysisWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
