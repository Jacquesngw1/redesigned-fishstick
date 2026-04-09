/**
 * Neuralis Black — GEO Audit SaaS Platform
 * lib/scoring.js
 *
 * Scoring and grading logic for GEO (Generative Engine Optimization) audits.
 */

/**
 * Grade thresholds
 */
const GRADES = [
  { min: 90, label: "A", description: "Excellent" },
  { min: 75, label: "B", description: "Good" },
  { min: 60, label: "C", description: "Average" },
  { min: 40, label: "D", description: "Below Average" },
  { min: 0,  label: "F", description: "Poor" },
];

/**
 * Score category weights (must sum to 1.0).
 */
const WEIGHTS = {
  visibility: 0.35,
  citationRate: 0.30,
  contentRelevance: 0.25,
  technicalHealth: 0.10,
};

/**
 * Derive a grade object from a numeric score (0–100).
 * @param {number} score
 * @returns {{ grade: string, description: string }}
 */
function getGrade(score) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  for (const g of GRADES) {
    if (clamped >= g.min) {
      return { grade: g.label, description: g.description };
    }
  }
  return { grade: "F", description: "Poor" };
}

/**
 * Calculate the weighted overall score from individual category scores.
 * @param {object} categoryScores
 * @param {number} [categoryScores.visibility]
 * @param {number} [categoryScores.citationRate]
 * @param {number} [categoryScores.contentRelevance]
 * @param {number} [categoryScores.technicalHealth]
 * @returns {number} Overall score (0–100, rounded)
 */
function calculateOverallScore(categoryScores = {}) {
  let total = 0;
  let weightUsed = 0;

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const raw = categoryScores[key];
    if (typeof raw === "number" && !Number.isNaN(raw)) {
      total += Math.max(0, Math.min(100, raw)) * weight;
      weightUsed += weight;
    }
  }

  if (weightUsed === 0) return 0;
  // Re-normalise if some categories were missing
  return Math.round(total / weightUsed);
}

/**
 * Score visibility based on how many AI-engine results mention the domain.
 * @param {object} params
 * @param {number} params.mentions      - Number of AI result snippets that mention the brand/domain
 * @param {number} params.totalQueries  - Total queries tested
 * @returns {number} Score 0–100
 */
function scoreVisibility({ mentions, totalQueries }) {
  if (!totalQueries) return 0;
  return Math.round((mentions / totalQueries) * 100);
}

/**
 * Score citation rate based on how often the domain appears as a cited source.
 * @param {object} params
 * @param {number} params.cited         - Times the domain was cited as a source
 * @param {number} params.totalQueries
 * @returns {number} Score 0–100
 */
function scoreCitationRate({ cited, totalQueries }) {
  if (!totalQueries) return 0;
  return Math.round((cited / totalQueries) * 100);
}

/**
 * Score content relevance using keyword match ratio.
 * @param {object} params
 * @param {string[]} params.targetKeywords  - Keywords the client wants to rank for
 * @param {string[]} params.foundKeywords   - Keywords found in AI-generated answers
 * @returns {number} Score 0–100
 */
function scoreContentRelevance({ targetKeywords = [], foundKeywords = [] }) {
  if (!targetKeywords.length) return 0;
  const foundSet = new Set(
    foundKeywords.map((k) => k.toLowerCase().trim())
  );
  const matches = targetKeywords.filter((k) =>
    foundSet.has(k.toLowerCase().trim())
  ).length;
  return Math.round((matches / targetKeywords.length) * 100);
}

/**
 * Score technical health (schema, structured data, page speed proxy).
 * @param {object} params
 * @param {boolean} params.hasSchemaMarkup
 * @param {boolean} params.hasOpenGraph
 * @param {boolean} params.hasCanonical
 * @param {number}  [params.loadTimeMs]     - Page load time in ms
 * @returns {number} Score 0–100
 */
function scoreTechnicalHealth({
  hasSchemaMarkup,
  hasOpenGraph,
  hasCanonical,
  loadTimeMs,
}) {
  let score = 0;
  if (hasSchemaMarkup) score += 35;
  if (hasOpenGraph) score += 25;
  if (hasCanonical) score += 20;

  // Performance bonus (up to 20 pts)
  if (typeof loadTimeMs === "number") {
    if (loadTimeMs < 1000) score += 20;
    else if (loadTimeMs < 2500) score += 10;
    else if (loadTimeMs < 4000) score += 5;
  }

  return Math.min(100, score);
}

/**
 * Generate textual recommendations based on category scores.
 * @param {object} scores
 * @returns {string[]} List of recommendation strings
 */
function generateRecommendations(scores = {}) {
  const recs = [];

  if ((scores.visibility ?? 100) < 60) {
    recs.push(
      "Increase brand visibility in AI-generated responses by publishing authoritative, frequently-cited content."
    );
  }
  if ((scores.citationRate ?? 100) < 60) {
    recs.push(
      "Improve citation rate by earning backlinks from high-authority sources that AI models reference."
    );
  }
  if ((scores.contentRelevance ?? 100) < 60) {
    recs.push(
      "Optimise content to better align with target keywords so AI models surface your pages as relevant answers."
    );
  }
  if ((scores.technicalHealth ?? 100) < 60) {
    recs.push(
      "Add structured data (Schema.org) and OpenGraph tags so AI crawlers can parse your content accurately."
    );
  }
  if ((scores.overall ?? 100) < 50) {
    recs.push(
      "Consider a full GEO content strategy overhaul — your site has significant room for improvement across all dimensions."
    );
  }

  if (recs.length === 0) {
    recs.push(
      "Your GEO performance is strong. Continue producing high-quality, authoritative content to maintain your position."
    );
  }

  return recs;
}

module.exports = {
  getGrade,
  calculateOverallScore,
  scoreVisibility,
  scoreCitationRate,
  scoreContentRelevance,
  scoreTechnicalHealth,
  generateRecommendations,
  WEIGHTS,
  GRADES,
};
