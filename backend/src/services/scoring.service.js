/* =========================================================
   ALGORITHMIC SCORING — "AI reads, algorithm decides"

   v6.16 (Oct 25, 2026) — FirstCommit '26 trust feature.

   The AI (Gemini) NEVER assigns a score. It only extracts
   structured facts from a submission (see ai.service.js).
   THIS module turns those facts into scores with fixed,
   documented rules, so:

   - same submission -> same score, every time
   - any score can be re-checked by hand from its breakdown
   - an eliminated team can be shown exactly WHY it lost

   Criteria (weights sum to 100):
     Theme fit    30  — does it solve THIS hackathon's problem?
     Innovation   25  — a genuinely new approach, not a clone
     Feasibility  25  — evidence it can actually be built/shown
     Clarity      20  — problem/solution explained clearly

   Theme gate: OFF_THEME submissions are capped at a total
   of 39 and can never be SELECTed, no matter how polished.

   Cutoff: total >= 70 -> SELECT, 40-69 -> REVIEW, <40 -> REJECT.
   The cutoff is a constant here so organizers see one rule;
   a per-hackathon override can be added later without
   changing the scoring math.

   This module has NO dependencies and NO randomness, so it
   is unit-testable in isolation (see /tmp test harness).
========================================================= */

export const WEIGHTS = {
  themeFit: 30,
  innovation: 25,
  feasibility: 25,
  clarity: 20,
};

export const CUTOFF_SELECT = 70;
export const OFF_THEME_CAP = 39;

/* Words too common to count as theme keywords. */
const STOPWORDS = new Set([
  "about", "above", "after", "again", "all", "also", "among", "and",
  "any", "are", "because", "been", "before", "being", "below", "between",
  "both", "but", "by", "can", "could", "for", "from", "had", "has",
  "have", "how", "into", "its", "more", "most", "not", "of", "off",
  "on", "one", "only", "our", "out", "over", "should", "some", "such",
  "than", "that", "the", "their", "them", "then", "there", "these",
  "they", "this", "through", "to", "under", "using", "via", "was",
  "were", "what", "when", "which", "while", "who", "will", "with",
  "within", "without", "your", "you", "build", "building", "create",
  "solution", "problem", "project", "system", "application", "app",
  "students", "student", "college", "campus", "india", "national",
  "hackathon", "team", "teams",
]);

/* Classic college-clone project shapes. Matching one is not
   an automatic fail — it just costs innovation points unless
   the submission shows a real differentiator (many features
   or a specific novel mechanism). */
const CLONE_PATTERNS = [
  /to[\s-]?do(\s+list|\s+app)?\b/i,
  /\battendance(\s+management|\s+system|\s+app)?\b/i,
  /\blibrary(\s+management|\s+system)?\b/i,
  /\bhospital(\s+management|\s+system)?\b/i,
  /\bchatbot\b/i,
  /\bgeneric\b.*\be-?commerce\b/i,
  /\bfood(\s+delivery|\s+ordering)?\s+app\b/i,
  /\bnotes?(\s+sharing|\s+app)?\b/i,
];

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

/* Theme keywords: distinct meaningful words from the
   hackathon title + description, capped for stability. */
export function extractThemeKeywords(themeText) {
  const seen = new Set();
  const keywords = [];
  for (const word of tokenize(themeText)) {
    if (!seen.has(word)) {
      seen.add(word);
      keywords.push(word);
    }
    if (keywords.length >= 40) break;
  }
  return keywords;
}

function countWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/* =========================================================
   THEME FIT (0-30)
========================================================= */

function scoreThemeFit({ searchText, themeKeywords }) {
  const haystack = ` ${String(searchText || "").toLowerCase()} `;
  let matched = 0;
  const matchedWords = [];
  for (const keyword of themeKeywords) {
    if (haystack.includes(` ${keyword} `) || haystack.includes(keyword)) {
      matched += 1;
      matchedWords.push(keyword);
    }
  }
  const total = themeKeywords.length;
  const ratio = total === 0 ? 0.5 : matched / total;

  let verdict = "PARTIAL";
  if (total === 0) verdict = "PARTIAL";
  else if (ratio >= 0.5) verdict = "ON_THEME";
  else if (ratio < 0.25) verdict = "OFF_THEME";

  const score = clampInt(ratio * WEIGHTS.themeFit, 0, WEIGHTS.themeFit);
  return {
    score,
    verdict,
    ratio: Number(ratio.toFixed(2)),
    matched,
    total,
    matchedWords,
    line:
      total === 0
        ? "Theme fit: no theme keywords available — scored as partial."
        : `Theme fit ${score}/${WEIGHTS.themeFit}: matched ${matched}/${total} theme keywords` +
          (matchedWords.length > 0 ? ` (${matchedWords.slice(0, 8).join(", ")})` : "") +
          ".",
  };
}

/* =========================================================
   INNOVATION (0-25)
========================================================= */

function scoreInnovation({ problemText, featureCount, noveltyText }) {
  const text = String(problemText || "");
  const cloneHit = CLONE_PATTERNS.find((re) => re.test(text));
  let score = WEIGHTS.innovation;
  const notes = [];

  if (cloneHit) {
    if (featureCount <= 3) {
      score -= 15;
      notes.push("matches a common clone project shape with few distinguishing features (-15)");
    } else {
      score -= 8;
      notes.push("matches a common clone project shape, but shows extra features (-8)");
    }
  }
  if (featureCount >= 5) {
    score += 0; // already at ceiling path; features counted in clarity/feasibility
    notes.push(`${featureCount} distinct features listed`);
  }
  if (String(noveltyText || "").trim().length >= 60) {
    notes.push("states a specific differentiator");
  } else if (!cloneHit) {
    score -= 5;
    notes.push("no specific differentiator stated (-5)");
  }

  score = clampInt(score, 0, WEIGHTS.innovation);
  return {
    score,
    line:
      `Innovation ${score}/${WEIGHTS.innovation}` +
      (notes.length > 0 ? `: ${notes.join("; ")}.` : "."),
  };
}

/* =========================================================
   FEASIBILITY (0-25)
========================================================= */

function scoreFeasibility({
  round,
  githubProvided,
  demoProvided,
  technologiesSpecified,
  solutionWords,
  featureCount,
  pdfChars,
}) {
  let score = 0;
  const notes = [];

  if (round === 2) {
    if (githubProvided) { score += 6; notes.push("GitHub repo linked (+6)"); }
    if (demoProvided) { score += 6; notes.push("live demo linked (+6)"); }
    if (pdfChars >= 1500) { score += 7; notes.push("detailed project report (+7)"); }
    else if (pdfChars >= 500) { score += 3; notes.push("short project report (+3)"); }
    if (featureCount >= 3) { score += 6; notes.push("3+ features described (+6)"); }
  } else {
    /* Round 1 has no tech-stack field by design, so
       feasibility is judged on explanation depth + features
       only (no penalty for a field that does not exist). */
    if (solutionWords >= 100) { score += 14; notes.push("solution explained in depth (+14)"); }
    else if (solutionWords >= 50) { score += 9; notes.push("solution explained briefly (+9)"); }
    else if (solutionWords >= 20) { score += 5; notes.push("solution very brief (+5)"); }
    if (featureCount >= 3) { score += 11; notes.push("3+ features described (+11)"); }
    else if (featureCount >= 1) { score += 5; notes.push("some features described (+5)"); }
  }

  score = clampInt(score, 0, WEIGHTS.feasibility);
  return {
    score,
    line:
      `Feasibility ${score}/${WEIGHTS.feasibility}` +
      (notes.length > 0 ? `: ${notes.join("; ")}.` : ": no evidence provided."),
  };
}

/* =========================================================
   CLARITY (0-20)
========================================================= */

function scoreClarity({ problemWords, solutionWords, featureCount }) {
  let score = 0;
  const notes = [];
  if (problemWords >= 30) { score += 7; notes.push("problem clearly stated (+7)"); }
  else if (problemWords >= 10) { score += 3; notes.push("problem stated briefly (+3)"); }
  if (solutionWords >= 50) { score += 7; notes.push("solution clearly explained (+7)"); }
  else if (solutionWords >= 20) { score += 3; notes.push("solution explained briefly (+3)"); }
  if (featureCount >= 3) { score += 6; notes.push("features listed (+6)"); }
  else if (featureCount >= 1) { score += 2; notes.push("some features listed (+2)"); }

  score = clampInt(score, 0, WEIGHTS.clarity);
  return {
    score,
    line:
      `Clarity ${score}/${WEIGHTS.clarity}` +
      (notes.length > 0 ? `: ${notes.join("; ")}.` : ": submission too brief to judge."),
  };
}

/* =========================================================
   MAIN ENTRY — deterministic, pure, no I/O
========================================================= */

/**
 * @param {object} input
 * @param {object} input.facts  AI-extracted facts:
 *   { problem_summary, features[], technologies[],
 *     theme_keywords_present[], demo_evidence: {github_provided, demo_provided},
 *     claimed_novelty }
 * @param {string} input.text  raw submission text (problem + solution,
 *   or PDF text for Round 2) used for keyword overlap + word counts
 * @param {string} input.themeText  hackathon title + description
 * @param {number} input.round  1 or 2
 * @returns full algorithmic verdict incl. human-readable breakdown
 */
export function scoreSubmission({ facts = {}, text = "", themeText = "", round = 1 }) {
  const features = Array.isArray(facts.features) ? facts.features : [];
  const themeKeywords = extractThemeKeywords(themeText);

  const theme = scoreThemeFit({
    searchText: `${text} ${facts.problem_summary || ""} ${features.join(" ")}`,
    themeKeywords,
  });

  const innovation = scoreInnovation({
    problemText: text,
    featureCount: features.length,
    noveltyText: facts.claimed_novelty || "",
  });

  const problemWords = countWords(facts.problem_summary || text);
  const solutionWords = countWords(text);

  const feasibility = scoreFeasibility({
    round,
    githubProvided: Boolean(facts.demo_evidence?.github_provided),
    demoProvided: Boolean(facts.demo_evidence?.demo_provided),
    technologiesSpecified:
      Array.isArray(facts.technologies) && facts.technologies.length > 0,
    solutionWords,
    featureCount: features.length,
    pdfChars: String(text || "").length,
  });

  const clarity = scoreClarity({
    problemWords,
    solutionWords,
    featureCount: features.length,
  });

  let total =
    theme.score + innovation.score + feasibility.score + clarity.score;

  const breakdown = [
    theme.line,
    innovation.line,
    feasibility.line,
    clarity.line,
  ];

  let capped = false;
  if (theme.verdict === "OFF_THEME" && total > OFF_THEME_CAP) {
    total = OFF_THEME_CAP;
    capped = true;
    breakdown.push(
      `Theme gate: OFF_THEME — total capped at ${OFF_THEME_CAP}, cannot be SELECTed.`
    );
  } else if (theme.verdict === "OFF_THEME") {
    breakdown.push(
      `Theme gate: OFF_THEME — cannot be SELECTed regardless of polish.`
    );
  }

  let recommendation = "REJECT";
  if (total >= CUTOFF_SELECT && theme.verdict !== "OFF_THEME") {
    recommendation = "SELECT";
  } else if (total >= 40) {
    recommendation = "REVIEW";
  }
  if (theme.verdict === "OFF_THEME" && recommendation === "SELECT") {
    recommendation = "REVIEW";
  }

  return {
    theme_fit_score: theme.score,
    innovation_score: innovation.score,
    feasibility_score: feasibility.score,
    clarity_score: clarity.score,
    overall_score: total,
    theme_verdict: theme.verdict,
    theme_keyword_ratio: theme.ratio,
    theme_keywords_matched: theme.matched,
    theme_keywords_total: theme.total,
    recommendation,
    theme_gate_capped: capped,
    breakdown,
  };
}

/* Legacy 0-100 projections of the algorithmic criteria, so
   existing organizer screens and DB columns keep working
   without any fabricated AI scores. Documented mapping:
   novelty <- innovation, relevance <- theme fit,
   technical <- feasibility, impact <- clarity (all rescaled). */
export function legacyProjection(scores) {
  const scale = (value, max) =>
    clampInt((value / max) * 100, 0, 100);
  return {
    novelty_score: scale(scores.innovation_score, WEIGHTS.innovation),
    relevance_score: scale(scores.theme_fit_score, WEIGHTS.themeFit),
    innovation_score: scale(scores.innovation_score, WEIGHTS.innovation),
    technical_score: scale(scores.feasibility_score, WEIGHTS.feasibility),
    impact_score: scale(scores.clarity_score, WEIGHTS.clarity),
  };
}
