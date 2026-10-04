
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

const DEFAULT_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.6-flash";

const GEMINI_MODELS = [
  DEFAULT_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
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
   RETRYABLE STATUS
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
   EXTRACT JSON
========================================================= */

function extractJson(text) {
  if (!text) {
    throw new Error("Gemini returned an empty response.");
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
      "Gemini response did not contain valid JSON."
    );
  }

  cleaned = cleaned.slice(
    firstBrace,
    lastBrace + 1
  );

  return JSON.parse(cleaned);
}

/* =========================================================
   BUILD IDEACHECK PROMPT
========================================================= */

function buildIdeaCheckPrompt({
  idea,
  matchedProject,
  similarityScore,
  similarProjectFound,
}) {
  const matchedProjectText = matchedProject
    ? `
MATCHED CAMPUSCODE REFERENCE PROJECT

Title:
${matchedProject.title || "Not provided"}

Category:
${matchedProject.category || "Not provided"}

Technology:
${matchedProject.technology || "Not provided"}

Description:
${matchedProject.description || "Not provided"}

Similarity score:
${similarityScore}%
`
    : `
NO STRONG MATCHED PROJECT WAS FOUND.

Similarity score:
${similarityScore}%
`;

  return `
You are IdeaCheck AI, the official idea analysis assistant inside CampusCode.

CampusCode is a student hackathon platform.

Your job is to help a student understand whether their project idea appears similar to an existing project in the CampusCode reference dataset and how they can improve or differentiate their idea.

IMPORTANT:

- The similarity calculation has already been performed by the CampusCode backend.
- Do NOT invent a different similarity score.
- Do NOT claim that the reference dataset represents the entire internet.
- Do NOT claim that an idea is definitely copied.
- A similarity result only means that the submitted idea has similarities with the CampusCode reference project.
- Be constructive and helpful.
- Focus on the project idea, not the student's personal characteristics.
- Do not invent technologies or features as if they already exist.
- Clearly distinguish between the student's current idea and your suggestions.
- Return ONLY valid JSON.
- Do not use Markdown.
- Do not wrap the JSON in code fences.

STUDENT IDEA

${idea}

SIMILARITY INFORMATION

Similar project found:
${similarProjectFound ? "YES" : "NO"}

Similarity score:
${similarityScore}%

${matchedProjectText}

YOUR TASK

Analyze the student's idea using the similarity information above.

If a similar project exists:

1. Explain the main areas of similarity.
2. Explain what appears different or potentially unique.
3. Suggest concrete ways to differentiate the idea.
4. Suggest useful features that could improve the idea.
5. Give a concise recommendation for how the student can make the project more distinctive.

If no similar project exists:

1. Explain why the idea appears reasonably distinct from the matched dataset result.
2. Identify strengths of the idea.
3. Suggest useful features.
4. Suggest ways to improve innovation and implementation.
5. Give a concise recommendation for moving forward.

Return exactly this JSON structure:

{
  "summary": "Short overall analysis.",
  "similarity_explanation": "Explain why the idea is or is not similar to the reference result.",
  "unique_points": [
    "Unique or potentially differentiated point 1",
    "Unique or potentially differentiated point 2",
    "Unique or potentially differentiated point 3"
  ],
  "improvement_suggestions": [
    "Concrete improvement 1",
    "Concrete improvement 2",
    "Concrete improvement 3"
  ],
  "feature_suggestions": [
    "Useful feature 1",
    "Useful feature 2",
    "Useful feature 3"
  ],
  "differentiation_strategy": "Explain how the student can make the idea more distinctive.",
  "ai_verdict": "DISTINCT",
  "confidence": 80
}

The ai_verdict MUST be exactly one of:

DISTINCT
SIMILAR
NEEDS_DIFFERENTIATION

The confidence must be an integer from 0 to 100.
`;
}

/* =========================================================
   CALL ONE GEMINI MODEL
========================================================= */

async function callGeminiModel(prompt, model) {
  let lastError = null;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES_PER_MODEL;
    attempt++
  ) {
    try {
      console.log(
        `IdeaCheck Gemini request: model=${model}, attempt=${
          attempt + 1
        }/${MAX_RETRIES_PER_MODEL + 1}`
      );

      const response = await fetch(
        `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            model,

            input: prompt,

            response_format: {
              type: "text",

              mime_type: "application/json",

              schema: {
                type: "object",

                properties: {
                  summary: {
                    type: "string",
                  },

                  similarity_explanation: {
                    type: "string",
                  },

                  unique_points: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },

                  improvement_suggestions: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },

                  feature_suggestions: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },

                  differentiation_strategy: {
                    type: "string",
                  },

                  ai_verdict: {
                    type: "string",

                    enum: [
                      "DISTINCT",
                      "SIMILAR",
                      "NEEDS_DIFFERENTIATION",
                    ],
                  },

                  confidence: {
                    type: "integer",
                  },
                },

                required: [
                  "summary",
                  "similarity_explanation",
                  "unique_points",
                  "improvement_suggestions",
                  "feature_suggestions",
                  "differentiation_strategy",
                  "ai_verdict",
                  "confidence",
                ],
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        console.error(
          `IDEACHECK GEMINI ERROR [${response.status}] using ${model}:`,
          errorText
        );

        if (
          isRetryableStatus(response.status) &&
          attempt < MAX_RETRIES_PER_MODEL
        ) {
          const delay = RETRY_DELAYS[attempt];

          console.log(
            `Temporary Gemini error (${response.status}). ` +
              `Retrying ${model} in ${delay / 1000}s...`
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
        `IDEACHECK GEMINI RESPONSE RECEIVED FROM ${model}`
      );

      const outputText =
        data.steps
          ?.filter(
            (step) =>
              step.type === "model_output"
          )
          ?.flatMap(
            (step) =>
              step.content || []
          )
          ?.filter(
            (content) =>
              content.type === "text"
          )
          ?.map(
            (content) =>
              content.text
          )
          ?.join("")
          ?.trim() || "";

      if (!outputText) {
        console.error(
          `IDEACHECK GEMINI EMPTY RESPONSE FROM ${model}:`,
          JSON.stringify(data, null, 2)
        );

        throw new Error(
          `Gemini returned no text output from ${model}`
        );
      }

      return {
        outputText,
        model,
      };
    } catch (error) {
      lastError = error;

      const status = error.status;

      const shouldRetry =
        attempt < MAX_RETRIES_PER_MODEL &&
        (!status || isRetryableStatus(status));

      if (shouldRetry) {
        const delay = RETRY_DELAYS[attempt];

        console.log(
          `IdeaCheck Gemini request error for ${model}. ` +
            `Retrying in ${delay / 1000}s...`
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

/* =========================================================
   CALL GEMINI WITH FALLBACK
========================================================= */

async function callGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not configured"
    );
  }

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      console.log(
        `IdeaCheck: trying Gemini model ${model}`
      );

      const result =
        await callGeminiModel(
          prompt,
          model
        );

      console.log(
        `IdeaCheck: Gemini analysis successful using ${model}`
      );

      return result;
    } catch (error) {
      lastError = error;

      console.error(
        `IdeaCheck Gemini model ${model} failed:`,
        error.message
      );

      /*
       * Authentication/configuration errors
       * should not switch models.
       */

      if (
        error.status === 400 ||
        error.status === 401 ||
        error.status === 403
      ) {
        throw error;
      }

      console.log(
        `IdeaCheck: switching from ${model} to next fallback model`
      );
    }
  }

  throw (
    lastError ||
    new Error(
      "All IdeaCheck Gemini models failed"
    )
  );
}

/* =========================================================
   MAIN IDEACHECK AI FUNCTION
========================================================= */

export async function analyzeIdeaWithGemini({
  idea,
  matchedProject,
  similarityScore,
  similarProjectFound,
}) {
  const prompt =
    buildIdeaCheckPrompt({
      idea,
      matchedProject,
      similarityScore,
      similarProjectFound,
    });

  const {
    outputText,
    model,
  } = await callGemini(prompt);

  const analysis =
    extractJson(outputText);

  /* =======================================================
     VALIDATE ARRAYS
  ======================================================= */

  const arrayFields = [
    "unique_points",
    "improvement_suggestions",
    "feature_suggestions",
  ];

  for (const field of arrayFields) {
    if (!Array.isArray(analysis[field])) {
      analysis[field] = [];
    }

    analysis[field] = analysis[field]
      .filter(
        (item) =>
          typeof item === "string" &&
          item.trim()
      )
      .map((item) => item.trim())
      .slice(0, 5);
  }

  /* =======================================================
     VALIDATE TEXT
  ======================================================= */

  const textFields = [
    "summary",
    "similarity_explanation",
    "differentiation_strategy",
  ];

  for (const field of textFields) {
    if (
      typeof analysis[field] !==
        "string" ||
      !analysis[field].trim()
    ) {
      analysis[field] =
        "No additional AI explanation was provided.";
    }

    analysis[field] =
      analysis[field].trim();
  }

  /* =======================================================
     VALIDATE VERDICT
  ======================================================= */

  const validVerdicts = [
    "DISTINCT",
    "SIMILAR",
    "NEEDS_DIFFERENTIATION",
  ];

  if (
    !validVerdicts.includes(
      analysis.ai_verdict
    )
  ) {
    analysis.ai_verdict =
      similarProjectFound
        ? "NEEDS_DIFFERENTIATION"
        : "DISTINCT";
  }

  /* =======================================================
     VALIDATE CONFIDENCE
  ======================================================= */

  let confidence =
    Number(analysis.confidence);

  if (!Number.isFinite(confidence)) {
    confidence = 50;
  }

  confidence = Math.max(
    0,
    Math.min(
      100,
      Math.round(confidence)
    )
  );

  analysis.confidence =
    confidence;

  return {
    ...analysis,

    model_name: model,
  };
}