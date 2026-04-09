/**
 * Neuralis Black — GEO Audit SaaS Platform
 * lib/audit-engine.js
 *
 * Core audit engine: orchestrates visibility checks, citation analysis,
 * content relevance scoring, and technical health checks for a given client.
 */

const axios = require("axios");
const {
  scoreVisibility,
  scoreCitationRate,
  scoreContentRelevance,
  scoreTechnicalHealth,
  calculateOverallScore,
  generateRecommendations,
} = require("./scoring");
const { saveAuditResult } = require("./airtable");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!OPENAI_API_KEY) {
  throw new Error("Missing required environment variable: OPENAI_API_KEY");
}

/**
 * Query an AI model (OpenAI) with a single question and return the text response.
 * @param {string} question
 * @returns {Promise<string>}
 */
async function queryAI(question) {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: question }],
      max_tokens: 512,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );
  return response.data.choices?.[0]?.message?.content || "";
}

/**
 * Check whether an AI-generated answer mentions the given domain or brand.
 * @param {string} answer
 * @param {string} domain
 * @returns {boolean}
 */
function mentionsDomain(answer, domain) {
  const normalized = domain.replace(/^https?:\/\//, "").replace(/^www\./, "");
  return answer.toLowerCase().includes(normalized.toLowerCase());
}

/**
 * Extract URLs that look like citations from an AI response.
 * @param {string} text
 * @returns {string[]}
 */
function extractCitations(text) {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  return text.match(urlRegex) || [];
}

/**
 * Perform the AI-visibility portion of the audit.
 * Sends several queries related to the client's keywords and checks how often
 * the AI mentions or cites the client's domain.
 * @param {object} client
 * @returns {Promise<object>}
 */
async function runVisibilityAudit(client) {
  const keywords = client.keywords || [];
  if (!keywords.length) {
    return {
      mentions: 0,
      cited: 0,
      totalQueries: 0,
      answers: [],
      foundKeywords: [],
    };
  }

  const queries = keywords.map(
    (kw) => `What are the best resources or companies for "${kw}"?`
  );

  const answers = [];
  let mentions = 0;
  let cited = 0;
  const foundKeywords = new Set();

  for (const query of queries) {
    try {
      const answer = await queryAI(query);
      answers.push({ query, answer });

      if (mentionsDomain(answer, client.domain)) {
        mentions++;
      }

      const citations = extractCitations(answer);
      const isCited = citations.some((url) =>
        url.toLowerCase().includes(client.domain.toLowerCase())
      );
      if (isCited) cited++;

      // Track which target keywords appear in the answer
      for (const kw of keywords) {
        if (answer.toLowerCase().includes(kw.toLowerCase())) {
          foundKeywords.add(kw);
        }
      }
    } catch (err) {
      console.error(`  AI query failed for "${query}":`, err.message);
    }
  }

  return {
    mentions,
    cited,
    totalQueries: queries.length,
    answers,
    foundKeywords: [...foundKeywords],
  };
}

/**
 * Perform a lightweight technical health check by fetching the client's homepage.
 * @param {string} domain
 * @returns {Promise<object>}
 */
async function runTechnicalCheck(domain) {
  const url = domain.startsWith("http") ? domain : `https://${domain}`;
  try {
    const start = Date.now();
    const response = await axios.get(url, { timeout: 10000 });
    const loadTimeMs = Date.now() - start;
    const html = response.data || "";

    const hasSchemaMarkup =
      html.includes('application/ld+json') ||
      html.includes('itemtype="http://schema.org');
    const hasOpenGraph = html.includes('property="og:');
    const hasCanonical = html.includes('rel="canonical"');

    return { hasSchemaMarkup, hasOpenGraph, hasCanonical, loadTimeMs };
  } catch {
    return {
      hasSchemaMarkup: false,
      hasOpenGraph: false,
      hasCanonical: false,
      loadTimeMs: null,
    };
  }
}

/**
 * Run a full GEO audit for a single client object.
 * @param {object} client - { id, name, domain, keywords, … }
 * @returns {Promise<object>} Audit result with scores, recommendations, and raw data
 */
async function runAudit(client) {
  console.log(`  → Running visibility audit for ${client.domain}…`);
  const visibilityData = await runVisibilityAudit(client);

  console.log(`  → Running technical check for ${client.domain}…`);
  const techData = await runTechnicalCheck(client.domain);

  const visibilityScore = scoreVisibility({
    mentions: visibilityData.mentions,
    totalQueries: visibilityData.totalQueries,
  });

  const citationScore = scoreCitationRate({
    cited: visibilityData.cited,
    totalQueries: visibilityData.totalQueries,
  });

  const contentScore = scoreContentRelevance({
    targetKeywords: client.keywords || [],
    foundKeywords: visibilityData.foundKeywords,
  });

  const techScore = scoreTechnicalHealth(techData);

  const overallScore = calculateOverallScore({
    visibility: visibilityScore,
    citationRate: citationScore,
    contentRelevance: contentScore,
    technicalHealth: techScore,
  });

  const scores = {
    overall: overallScore,
    visibility: visibilityScore,
    citationRate: citationScore,
    contentRelevance: contentScore,
    technicalHealth: techScore,
  };

  const recommendations = generateRecommendations(scores);

  return {
    clientId: client.id,
    domain: client.domain,
    scores,
    recommendations,
    rawResults: {
      visibility: visibilityData,
      technical: techData,
    },
  };
}

/**
 * Run an audit for a specific client by ID, saving the result to Airtable.
 * @param {string} clientId
 * @returns {Promise<object>}
 */
async function runAuditForClient(clientId) {
  const { getClients } = require("./airtable");
  const clients = await getClients({ id: clientId });

  if (!clients || clients.length === 0) {
    throw new Error(`Client not found: ${clientId}`);
  }

  const client = clients[0];
  const result = await runAudit(client);
  const recordId = await saveAuditResult(result);

  return { ...result, auditRecordId: recordId, success: true };
}

/**
 * Run audits for a list of client objects, saving each result.
 * @param {Array} clients
 * @returns {Promise<Array>}
 */
async function runAuditForAllClients(clients) {
  const results = [];

  for (const client of clients) {
    try {
      console.log(`\n🔍 Auditing: ${client.name} (${client.domain})`);
      const result = await runAudit(client);
      const recordId = await saveAuditResult(result);
      results.push({ ...result, auditRecordId: recordId, success: true });
      console.log(
        `  ✅ Done. Overall score: ${result.scores.overall}/100`
      );
    } catch (err) {
      console.error(`  ❌ Failed for ${client.name}:`, err.message);
      results.push({ clientId: client.id, success: false, error: err.message });
    }
  }

  return results;
}

module.exports = {
  runAudit,
  runAuditForClient,
  runAuditForAllClients,
  runVisibilityAudit,
  runTechnicalCheck,
};
