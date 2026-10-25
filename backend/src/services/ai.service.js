/* =========================================================
   AI SERVICE — Gemini extraction + algorithmic scoring

   v6.16 (Oct 25, 2026) — "AI reads, algorithm decides."

   ARCHITECTURE CHANGE (read before editing):
   Gemini NEVER assigns a score anymore. It only extracts
   structured FACTS from a submission (problem, features,
   tech, theme keywords, demo evidence). The deterministic
   rubric in scoring.service.js turns those facts into
   scores, so the same submission always gets the same
   score and any score can be re-checked from its breakdown.

   What changed vs v6.15:
   - Prompts ask for FACTS only (no novelty/relevance/
     innovation/technical/impact scores from the model).
   - generationConfig now sets temperature: 0 (least
     creative, most repeatable extraction).
   - API keys come from the geminiKeys pool: GEMINI_API_KEYS
     (comma-separated, 5-10 for events) + legacy
     GEMINI_API_KEY. A failing key cools down 60s and the
     next key is tried immediately.
   - analyzeProjectWithAI / analyzeRound2ProjectWithAI keep
     their names and return the legacy 0-100 score fields
     as DOCUMENTED projections of the algorithmic criteria
     (see scoring.service.js legacyProjection), so every
     existing controller, worker write and organizer screen
     keeps working unchanged. The new criteria, theme
     verdict and breakdown ride along in the same object.

   These functions do NOT write to the database.
   Controllers / the worker handle persistence.
========================================================= */

import {
  scoreSubmission,
  legacyProjection,
} from "./scoring.service.js";

import {
  nextKeyIndex,
  getKeyByIndex,
  reportKeyFailure,
  reportKeySuccess,
  geminiKeyCount,
} from "./geminiKeys.service.js";

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta";

const DEFAULT_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.5-flash";

/*
 * If the primary Gemini model is temporarily unavailable (503),
 * automatically try fallback models.
 */
const GEMINI_MODELS = [
  DEFAULT_MODEL,
  "gemini-3.6-flash",
  "gemini-3.7-flash",
];

const MAX_RETRIES_PER_MODEL = 2;

const RETRY_DELAYS = [2000, 5000];

/* =========================================================
   WAIT
========================================================= */

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/* =========================================================
   CHECK WHETHER ERROR SHOULD BE RETRIED
========================================================= */

function isRetryableStatus(status) {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

/* =========================================================
   EXTRACT JSON FROM MODEL RESPONSE
========================================================= */

function extractJson(text) {
  if (!text) {
    throw new Error("AI returned an empty response");
  }

  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace <= firstBrace
  ) {
    throw new Error(
      "AI response did not contain valid JSON"
    );
  }

  cleaned = cleaned.slice(
    firstBrace,
    lastBrace + 1
  );

  return JSON.parse(cleaned);
}

/* =========================================================
   FACTS SCHEMA (shared by R1 + R2 extraction)
========================================================= */

const FACTS_SCHEMA = {
  type: "object",

  properties: {
    problem_summary: { type: "string" },
    features: { type: "array", items: { type: "string" } },
    technologies: { type: "array", items: { type: "string" } },
    theme_keywords_present: { type: "array", items: { type: "string" } },
    demo_evidence: {
      type: "object",
      properties: {
        github_provided: { type: "boolean" },
        demo_provided: { type: "boolean" },
      },
    },
    claimed_novelty: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
    feedback: { type: "string" },
  },

  required: [
    "problem_summary",
    "features",
    "technologies",
    "theme_keywords_present",
    "demo_evidence",
    "claimed_novelty",
    "feedback",
  ],
};

function validateFacts(facts) {
  if (!facts || typeof facts !== "object") {
    throw new Error("AI facts are missing");
  }
  for (const field of ["features", "technologies", "theme_keywords_present"]) {
    if (!Array.isArray(facts[field])) facts[field] = [];
    facts[field] = facts[field].map(String).filter(Boolean);
  }
  if (!facts.demo_evidence || typeof facts.demo_evidence !== "object") {
    facts.demo_evidence = {};
  }
  facts.demo_evidence.github_provided = Boolean(
    facts.demo_evidence.github_provided
  );
  facts.demo_evidence.demo_provided = Boolean(
    facts.demo_evidence.demo_provided
  );
  for (const field of ["strengths", "weaknesses", "suggestions"]) {
    if (!Array.isArray(facts[field])) facts[field] = [];
    facts[field] = facts[field].map(String).filter(Boolean);
  }
  facts.problem_summary = String(facts.problem_summary || "");
  facts.claimed_novelty = String(facts.claimed_novelty || "");
  facts.feedback = String(facts.feedback || "");
  if (!facts.feedback.trim()) {
    throw new Error("AI feedback is missing");
  }
  return facts;
}

/* =========================================================
   BUILD FACTS-EXTRACTION PROMPT (ROUND 1)
========================================================= */

function buildExtractionPrompt(project, themeText) {
  return `
You are the fact-extraction engine for CampusCode,
a student hackathon platform.

Your job is ONLY to read a project submission and extract
structured facts. You do NOT score, rank, or recommend.
A deterministic algorithm scores the project from the
facts you return.

HACKATHON THEME (the problem space this event is about):
${themeText || "Not provided"}

PROJECT INFORMATION

Title:
${project.title || "Not provided"}

Track:
${project.track || "Not specified"}

Problem Statement:
${project.problem_statement || "Not provided"}

Solution:
${project.solution || "Not provided"}

Technologies:
${
  Array.isArray(project.technologies)
    ? project.technologies.join(", ")
    : project.technologies || "Not provided"
}

GitHub:
${project.github_url || "Not provided"}

Live Demo:
${project.live_demo_url || "Not provided"}

EXTRACT, DO NOT JUDGE:

- problem_summary: one faithful paragraph of what problem
  the team says they solve (their words, condensed).
- features: every concrete feature the submission mentions.
- technologies: every technology named.
- theme_keywords_present: words from the hackathon theme
  that actually appear in the submission text.
- demo_evidence: whether a GitHub URL / live demo URL was
  actually provided (true/false, from the fields above).
- claimed_novelty: what the team claims is new or different
  about their approach, in their own terms. If they claim
  nothing specific, say so.
- strengths / weaknesses / suggestions: short, specific,
  constructive observations a student team can act on.
- feedback: a constructive summary of the project.

IMPORTANT:

- Do not invent features that are not mentioned.
- Do not assume a GitHub repository or live demo works
  if no evidence is provided.
- Do not evaluate personal characteristics of team members.
- Evaluate only the project information provided.
- Return ONLY valid JSON.
- Do not use Markdown.
- Do not wrap the JSON in code fences.

Required JSON format:

{
  "problem_summary": "",
  "features": [],
  "technologies": [],
  "theme_keywords_present": [],
  "demo_evidence": { "github_provided": false, "demo_provided": false },
  "claimed_novelty": "",
  "strengths": [],
  "weaknesses": [],
  "suggestions": [],
  "feedback": ""
}
`;
}

/* =========================================================
   BUILD FACTS-EXTRACTION PROMPT (ROUND 2, PDF REPORT)
========================================================= */

function buildRound2ExtractionPrompt({
  hackathonTitle,
  themeText,
  githubUrl,
  pdfText,
}) {
  return `
You are the fact-extraction engine for CampusCode,
a student hackathon platform.

Your job is ONLY to read a Round 2 project report and
extract structured facts. You do NOT score, rank, or
recommend. A deterministic algorithm scores the project
from the facts you return.

HACKATHON:
${hackathonTitle || "Not provided"}

HACKATHON THEME (the problem space this event is about):
${themeText || "Not provided"}

GITHUB URL:
${githubUrl || "Not provided"}

PROJECT REPORT EXTRACTED FROM PDF:
${pdfText}

EXTRACT, DO NOT JUDGE:

- problem_summary: one faithful paragraph of what problem
  the team says they solve.
- features: every concrete feature the report mentions.
- technologies: every technology named.
- theme_keywords_present: words from the hackathon theme
  that actually appear in the report text.
- demo_evidence: github_provided = whether a GitHub URL
  was provided above; demo_provided = whether the report
  mentions a working live demo link.
- claimed_novelty: what the team claims is new or different
  about their approach, in their own terms.
- strengths / weaknesses / suggestions: short, specific,
  constructive observations.
- feedback: a constructive summary of the project.

IMPORTANT:

- Base the extraction only on the information provided.
- Do not invent project features.
- If information is missing, say so in the feedback.
- Do not evaluate information that is not supplied.
- Return ONLY valid JSON, no Markdown, no code fences.

Required JSON format:

{
  "problem_summary": "",
  "features": [],
  "technologies": [],
  "theme_keywords_present": [],
  "demo_evidence": { "github_provided": false, "demo_provided": false },
  "claimed_novelty": "",
  "strengths": [],
  "weaknesses": [],
  "suggestions": [],
  "feedback": ""
}
`;
}

/* =========================================================
   CALL ONE GEMINI MODEL (key pool + rotation)
========================================================= */

async function callGeminiModel(prompt, model) {
  let lastError = null;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES_PER_MODEL;
    attempt++
  ) {
    const keyIndex = nextKeyIndex();
    if (keyIndex === null) {
      throw new Error(
        "All Gemini API keys are cooling down after failures"
      );
    }
    const apiKey = getKeyByIndex(keyIndex);

    try {
      console.log(
        `Gemini request: model=${model}, key#${keyIndex}, attempt=${attempt + 1}/${
          MAX_RETRIES_PER_MODEL + 1
        }`
      );

      const response = await fetch(
        `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],

            generationConfig: {
              /* v6.16: temperature 0 = least creative,
                 most repeatable extraction. */
              temperature: 0,

              responseMimeType: "application/json",

              responseSchema: FACTS_SCHEMA,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        console.error(
          `GEMINI API ERROR [${response.status}] using ${model}, key#${keyIndex}:`,
          errorText.slice(0, 300)
        );

        if (
          isRetryableStatus(response.status) &&
          attempt < MAX_RETRIES_PER_MODEL
        ) {
          reportKeyFailure(keyIndex, response.status);
          const delay = RETRY_DELAYS[attempt];
          console.log(
            `Temporary Gemini error (${response.status}). ` +
              `Rotating key, retrying ${model} in ${delay / 1000}s...`
          );
          await sleep(delay);
          continue;
        }

        const error = new Error(
          `Gemini API error: ${response.status}`
        );
        error.status = response.status;
        error.model = model;
        error.responseBody = errorText;
        throw error;
      }

      const data = await response.json();

      console.log(
        `GEMINI RESPONSE RECEIVED FROM ${model} (key#${keyIndex})`
      );

      const outputText =
        data.candidates?.[0]?.content?.parts
          ?.map((part) => part?.text || "")
          ?.join("")
          ?.trim() || "";

      if (!outputText) {
        console.error(
          `GEMINI EMPTY RESPONSE FROM ${model}:`,
          JSON.stringify(data, null, 2).slice(0, 500)
        );
        throw new Error(
          `Gemini returned no text output from ${model}`
        );
      }

      reportKeySuccess(keyIndex);

      return {
        outputText,
        model,
      };
    } catch (error) {
      lastError = error;

      /*
       * Do not retry authentication/configuration errors.
       */
      const status = error.status;

      const shouldRetry =
        attempt < MAX_RETRIES_PER_MODEL &&
        (!status || isRetryableStatus(status));

      if (shouldRetry) {
        reportKeyFailure(keyIndex, status);
        const delay = RETRY_DELAYS[attempt];
        console.log(
          `Gemini request error for ${model}. ` +
            `Rotating key, retrying in ${delay / 1000}s...`
        );
        await sleep(delay);
        continue;
      }

      break;
    }
  }

  throw lastError ||
    new Error(
      `Gemini model ${model} failed`
    );
}

/* =========================================================
   CALL GEMINI WITH MODEL FALLBACK
========================================================= */

async function callGemini(prompt) {
  if (geminiKeyCount() === 0) {
    throw new Error(
      "GEMINI_API_KEY is not configured"
    );
  }

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      console.log(
        `Trying Gemini model: ${model}`
      );

      const result =
        await callGeminiModel(
          prompt,
          model
        );

      console.log(
        `Gemini extraction successful using ${model}`
      );

      return result;
    } catch (error) {
      lastError = error;

      console.error(
        `Gemini model ${model} failed:`,
        error.message
      );

      /*
       * Do not switch models for permanent
       * authentication/configuration errors.
       */

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

  throw lastError ||
    new Error(
      "All Gemini models failed"
    );
}

/* =========================================================
   COMBINE FACTS + ALGORITHMIC SCORE (shared)
========================================================= */

function buildAnalysis({ facts, scores, model }) {
  const legacy = legacyProjection(scores);
  return {
    /* Legacy 0-100 fields (projections of algorithmic
       criteria — keeps every existing screen working). */
    ...legacy,

    /* New algorithmic criteria (primary truth). */
    theme_fit_score: scores.theme_fit_score,
    feasibility_score: scores.feasibility_score,
    clarity_score: scores.clarity_score,
    innovation_score_algo: scores.innovation_score,

    overall_score: scores.overall_score,
    theme_verdict: scores.theme_verdict,
    recommendation:
      scores.recommendation,
    breakdown: scores.breakdown,
    theme_gate_capped: scores.theme_gate_capped,

    feedback: facts.feedback,
    strengths: facts.strengths,
    weaknesses: facts.weaknesses,
    suggestions: facts.suggestions,
    facts,

    model_name: model,
  };
}

/* =========================================================
   ANALYZE PROJECT WITH AI (ROUND 1 + generic projects)

   Shared by:
   - automatic student-side analysis after submission
   - organizer manual Analyze / Re-analyze

   This function does NOT write to the database.
   The controller / worker handles persistence.
========================================================= */

export async function analyzeProjectWithAI(
  project
) {
  if (geminiKeyCount() === 0) {
    throw new Error(
      "GEMINI_API_KEY is not configured"
    );
  }

  const themeText = [
    project.hackathon_title || "",
    project.hackathon_description || "",
  ]
    .join(" ")
    .trim();

  const text = [
    project.problem_statement || "",
    project.solution || "",
  ]
    .join("\n")
    .trim();

  const prompt =
    buildExtractionPrompt(project, themeText);

  const {
    outputText,
    model,
  } = await callGemini(prompt);

  const facts = validateFacts(extractJson(outputText));

  /* Evidence flags come from the actual submitted fields,
     not from the model's reading of them. */
  facts.demo_evidence.github_provided = Boolean(
    project.github_url && String(project.github_url).trim()
  );
  facts.demo_evidence.demo_provided = Boolean(
    project.live_demo_url && String(project.live_demo_url).trim()
  );

  const scores = scoreSubmission({
    facts,
    text,
    themeText,
    round: 1,
  });

  return buildAnalysis({ facts, scores, model });
}

/* =========================================================
   ANALYZE ROUND 2 PROJECT WITH AI (PDF REPORT)

   Shared by:
   - automatic student-side analysis after submission
   - organizer manual Analyze / Re-analyze

   This function does NOT write to the database.
   The controller handles database persistence.
========================================================= */

export async function analyzeRound2ProjectWithAI({
  hackathon_title,
  hackathon_description,
  github_url,
  pdf_text,
}) {
  if (geminiKeyCount() === 0) {
    throw new Error(
      "GEMINI_API_KEY is not configured"
    );
  }

  const githubUrl =
    typeof github_url === "string" &&
    github_url.trim()
      ? github_url.trim()
      : "Not provided";

  const pdfText =
    typeof pdf_text === "string"
      ? pdf_text.trim()
      : "";

  if (pdfText.length < 20) {
    throw new Error(
      "Round 2 PDF text is too short for AI analysis"
    );
  }

  const maxCharacters = 30000;

  const limitedPdfText =
    pdfText.length > maxCharacters
      ? pdfText.substring(
          0,
          maxCharacters
        ) +
        "\n\n[PDF text truncated for AI analysis]"
      : pdfText;

  const themeText = [
    hackathon_title || "",
    hackathon_description || "",
  ]
    .join(" ")
    .trim();

  const prompt = buildRound2ExtractionPrompt({
    hackathonTitle: hackathon_title,
    themeText,
    githubUrl,
    pdfText: limitedPdfText,
  });

  const {
    outputText,
    model,
  } = await callGemini(prompt);

  const facts = validateFacts(extractJson(outputText));

  /* GitHub evidence from the actual submitted field. */
  facts.demo_evidence.github_provided =
    githubUrl !== "Not provided";

  const scores = scoreSubmission({
    facts,
    text: limitedPdfText,
    themeText,
    round: 2,
  });

  return buildAnalysis({ facts, scores, model });
}
