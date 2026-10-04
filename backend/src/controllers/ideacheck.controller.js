import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  analyzeIdeaWithGemini,
} from "../services/ideacheck.ai.service.js";

/* =========================================================
   PATH
========================================================= */

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const DATA_FILE = path.join(
  __dirname,
  "../../data/ideacheck_projects.json"
);

/* =========================================================
   DATASET CACHE
========================================================= */

let projectsCache = null;

/* =========================================================
   LOAD DATASET
========================================================= */

function loadProjects() {
  if (projectsCache) {
    return projectsCache;
  }

  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(
      "IdeaCheck dataset not found."
    );
  }

  const rawData =
    fs.readFileSync(
      DATA_FILE,
      "utf-8"
    );

  projectsCache =
    JSON.parse(rawData);

  console.log(
    `IdeaCheck: loaded ${projectsCache.length} projects`
  );

  return projectsCache;
}

/* =========================================================
   TEXT NORMALIZATION
========================================================= */

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   STOP WORDS
========================================================= */

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "using",
  "use",
  "based",
  "system",
  "application",
  "app",
  "platform",
  "project",
  "solution",
  "that",
  "this",
  "is",
  "are",
  "be",
  "from",
  "by",
  "can",
  "helps",
  "help",
  "users",
  "user",
]);

/* =========================================================
   TOKENIZE
========================================================= */

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .filter(
      (word) =>
        word.length > 2 &&
        !STOP_WORDS.has(word)
    );
}

/* =========================================================
   TERM FREQUENCY
========================================================= */

function termFrequency(tokens) {
  const frequencies = {};

  for (const token of tokens) {
    frequencies[token] =
      (frequencies[token] || 0) + 1;
  }

  return frequencies;
}

/* =========================================================
   COSINE SIMILARITY
========================================================= */

function cosineSimilarity(
  tokensA,
  tokensB
) {
  if (
    !tokensA.length ||
    !tokensB.length
  ) {
    return 0;
  }

  const tfA =
    termFrequency(tokensA);

  const tfB =
    termFrequency(tokensB);

  const vocabulary =
    new Set([
      ...Object.keys(tfA),
      ...Object.keys(tfB),
    ]);

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const word of vocabulary) {
    const a =
      tfA[word] || 0;

    const b =
      tfB[word] || 0;

    dotProduct += a * b;

    magnitudeA +=
      a * a;

    magnitudeB +=
      b * b;
  }

  if (
    magnitudeA === 0 ||
    magnitudeB === 0
  ) {
    return 0;
  }

  return (
    dotProduct /
    (
      Math.sqrt(magnitudeA) *
      Math.sqrt(magnitudeB)
    )
  );
}

/* =========================================================
   KEYWORD OVERLAP
========================================================= */

function keywordOverlap(
  tokensA,
  tokensB
) {
  if (
    !tokensA.length ||
    !tokensB.length
  ) {
    return 0;
  }

  const setA =
    new Set(tokensA);

  const setB =
    new Set(tokensB);

  let matches = 0;

  for (const word of setA) {
    if (setB.has(word)) {
      matches++;
    }
  }

  return (
    matches /
    Math.max(
      setA.size,
      setB.size
    )
  );
}

/* =========================================================
   FINAL SIMILARITY SCORE
========================================================= */

function calculateSimilarity(
  userTokens,
  projectTokens
) {
  const cosine =
    cosineSimilarity(
      userTokens,
      projectTokens
    );

  const overlap =
    keywordOverlap(
      userTokens,
      projectTokens
    );

  const score =
    cosine * 70 +
    overlap * 30;

  return Math.min(
    100,
    Math.round(
      score * 100
    ) / 100
  );
}

/* =========================================================
   FIND BEST MATCH
========================================================= */

function findBestMatch(
  description
) {
  const projects =
    loadProjects();

  const userTokens =
    tokenize(description);

  if (
    userTokens.length < 3
  ) {
    return null;
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const project of projects) {
    const projectText =
      `${project.title} ${project.description} ${project.category}`;

    const projectTokens =
      tokenize(projectText);

    const similarity =
      calculateSimilarity(
        userTokens,
        projectTokens
      );

    if (
      similarity >
      bestScore
    ) {
      bestScore =
        similarity;

      bestMatch = {
        ...project,

        similarity_score:
          Math.round(
            similarity
          ),
      };
    }
  }

  return bestMatch;
}

/* =========================================================
   IDEA QUALITY ANALYSIS
========================================================= */

function calculateIdeaScores(
  description
) {
  const text =
    normalizeText(
      description
    );

  const words =
    text.split(" ");

  const lengthScore =
    Math.min(
      10,
      Math.max(
        3,
        Math.floor(
          words.length / 5
        )
      )
    );

  const technologyKeywords = [
    "ai",
    "artificial intelligence",
    "machine learning",
    "ml",
    "deep learning",
    "blockchain",
    "iot",
    "cloud",
    "react",
    "node",
    "python",
    "flutter",
    "android",
    "computer vision",
    "nlp",
    "api",
  ];

  const problemKeywords = [
    "solve",
    "problem",
    "reduce",
    "improve",
    "help",
    "detect",
    "prevent",
    "monitor",
    "automate",
    "predict",
    "support",
    "manage",
  ];

  const impactKeywords = [
    "students",
    "farmers",
    "patients",
    "healthcare",
    "business",
    "community",
    "environment",
    "education",
    "users",
    "customers",
    "people",
  ];

  const technologyMatches =
    technologyKeywords.filter(
      (keyword) =>
        text.includes(keyword)
    ).length;

  const problemMatches =
    problemKeywords.filter(
      (keyword) =>
        text.includes(keyword)
    ).length;

  const impactMatches =
    impactKeywords.filter(
      (keyword) =>
        text.includes(keyword)
    ).length;

  const technologyScore =
    Math.min(
      10,
      Math.max(
        4,
        5 + technologyMatches
      )
    );

  const usageScore =
    Math.min(
      10,
      Math.max(
        4,
        5 +
          Math.min(
            impactMatches,
            5
          )
      )
    );

  const innovationScore =
    Math.min(
      10,
      Math.max(
        4,
        5 +
          Math.min(
            technologyMatches,
            3
          )
      )
    );

  const practicalityScore =
    Math.min(
      10,
      Math.max(
        4,
        5 +
          Math.min(
            problemMatches,
            5
          )
      )
    );

  const feasibilityScore =
    Math.min(
      10,
      Math.max(
        4,
        lengthScore
      )
    );

  const overallScore =
    (
      technologyScore +
      usageScore +
      innovationScore +
      practicalityScore +
      feasibilityScore
    ) / 5;

  return {
    technology:
      technologyScore,

    usage:
      usageScore,

    innovation:
      innovationScore,

    practicality:
      practicalityScore,

    feasibility:
      feasibilityScore,

    overall:
      Math.round(
        overallScore * 10
      ) / 10,
  };
}

/* =========================================================
   VERDICT
========================================================= */

function getVerdict(
  overallScore
) {
  if (
    overallScore >= 8.5
  ) {
    return {
      label:
        "EXCELLENT IDEA",

      emoji: "🚀",
    };
  }

  if (
    overallScore >= 7
  ) {
    return {
      label:
        "GOOD IDEA",

      emoji: "👍",
    };
  }

  if (
    overallScore >= 5.5
  ) {
    return {
      label:
        "PROMISING IDEA",

      emoji: "💡",
    };
  }

  return {
    label:
      "NEEDS IMPROVEMENT",

    emoji: "🛠️",
  };
}

/* =========================================================
   SUGGESTIONS
========================================================= */

function generateSuggestions(
  scores,
  hasSimilarProject
) {
  const suggestions = [];

  if (
    scores.innovation < 8
  ) {
    suggestions.push(
      "Add a unique feature or approach that differentiates the project from existing solutions."
    );
  }

  if (
    scores.usage < 7
  ) {
    suggestions.push(
      "Clearly identify the target users and explain how the project solves a real problem for them."
    );
  }

  if (
    scores.technology < 7
  ) {
    suggestions.push(
      "Consider using a suitable modern technology or AI capability where it provides real value."
    );
  }

  if (
    scores.practicality < 7
  ) {
    suggestions.push(
      "Define the problem more clearly and focus on a practical implementation."
    );
  }

  if (
    hasSimilarProject
  ) {
    suggestions.push(
      "Since a similar project was found, consider adding a different feature, workflow, or technical approach."
    );
  }

  if (
    suggestions.length === 0
  ) {
    suggestions.push(
      "The idea is well balanced. Focus on implementation quality and measurable results."
    );
  }

  return suggestions;
}

/* =========================================================
   MAIN IDEACHECK API
========================================================= */

export const checkIdea =
  async (req, res) => {
    try {
      const {
        project_description,
      } = req.body;

      /* =====================================================
         VALIDATION
      ===================================================== */

      if (
        !project_description ||
        typeof project_description !==
          "string"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "project_description is required.",
        });
      }

      const description =
        project_description.trim();

      if (
        description.length < 10
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Please provide a more detailed project idea.",
        });
      }

      if (
        description.length > 5000
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Project description cannot exceed 5000 characters.",
        });
      }

      /* =====================================================
         DATASET SIMILARITY
      ===================================================== */

      const bestMatch =
        findBestMatch(
          description
        );

      const similarityScore =
        bestMatch?.similarity_score ||
        0;

      const similarProject =
        similarityScore >= 70;

      /* =====================================================
         LOCAL IDEA EVALUATION
      ===================================================== */

      const scores =
        calculateIdeaScores(
          description
        );

      const verdict =
        getVerdict(
          scores.overall
        );

      const suggestions =
        generateSuggestions(
          scores,
          similarProject
        );

      /* =====================================================
         GEMINI AI ANALYSIS
      ===================================================== */

      let aiAnalysis = null;

      try {
        aiAnalysis =
          await analyzeIdeaWithGemini({
            idea: description,

            matchedProject:
              bestMatch,

            similarityScore,

            similarProjectFound:
              similarProject,
          });
      } catch (aiError) {
        /*
         * IdeaCheck should still return
         * the dataset result even if Gemini
         * is temporarily unavailable.
         */

        console.error(
          "IDEACHECK GEMINI ANALYSIS ERROR:",
          aiError
        );

        aiAnalysis = {
          available: false,

          message:
            "AI explanation is temporarily unavailable. The similarity analysis is still available.",

          model_name: null,
        };
      }

      /* =====================================================
         FINAL RESPONSE
      ===================================================== */

      return res.json({
        success: true,

        message:
          "IdeaCheck analysis completed.",

        idea: description,

        similarity_check: {
          status:
            similarProject
              ? "SIMILAR_FOUND"
              : "NO_SIMILAR_PROJECT",

          similarity_score:
            similarityScore,

          matched_project:
            similarProject &&
            bestMatch
              ? {
                  id:
                    bestMatch.id,

                  title:
                    bestMatch.title,

                  description:
                    bestMatch.description,

                  category:
                    bestMatch.category,

                  technology:
                    bestMatch.technology,
                }
              : null,
        },

        idea_evaluation: {
          technology:
            scores.technology,

          usage:
            scores.usage,

          innovation:
            scores.innovation,

          practicality:
            scores.practicality,

          feasibility:
            scores.feasibility,

          overall:
            scores.overall,

          verdict:
            verdict.label,

          verdict_emoji:
            verdict.emoji,
        },

        suggestions,

        /*
         * Gemini-powered explanation
         */

        ai_analysis: aiAnalysis,

        disclaimer:
          "IdeaCheck compares the idea against the CampusCode reference dataset. A similarity result does not prove that an idea already exists on the internet.",
      });
    } catch (error) {
      console.error(
        "IdeaCheck error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "IdeaCheck failed to analyze the project idea.",

        error:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      });
    }
  };

/* =========================================================
   DATASET INFO
========================================================= */

export const getIdeaCheckStats =
  async (req, res) => {
    try {
      const projects =
        loadProjects();

      const categoryCounts =
        {};

      for (
        const project of projects
      ) {
        categoryCounts[
          project.category
        ] =
          (
            categoryCounts[
              project.category
            ] || 0
          ) + 1;
      }

      return res.json({
        success: true,

        total_projects:
          projects.length,

        categories:
          categoryCounts,
      });
    } catch (error) {
      console.error(
        "IdeaCheck stats error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to load IdeaCheck statistics.",
      });
    }
  };