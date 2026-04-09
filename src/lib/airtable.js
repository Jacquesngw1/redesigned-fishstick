/**
 * Neuralis Black — GEO Audit SaaS Platform
 * lib/airtable.js
 *
 * Airtable integration helpers for reading/writing clients,
 * audit results, and reports.
 */

const Airtable = require("airtable");

if (!process.env.AIRTABLE_API_KEY) {
  throw new Error("Missing required environment variable: AIRTABLE_API_KEY");
}
if (!process.env.AIRTABLE_BASE_ID) {
  throw new Error("Missing required environment variable: AIRTABLE_BASE_ID");
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

const TABLES = {
  CLIENTS: "Clients",
  AUDITS: "Audits",
  REPORTS: "Reports",
};

/**
 * Fetch clients from Airtable, optionally filtered.
 * @param {object} [filters]
 * @param {string} [filters.status]   - Filter by Status field (e.g. "active")
 * @param {string} [filters.id]       - Filter by record ID
 * @returns {Promise<Array>}
 */
async function getClients(filters = {}) {
  const formulaParts = [];

  if (filters.status) {
    formulaParts.push(`{Status} = "${filters.status}"`);
  }

  const selectOptions = {
    view: "Grid view",
    ...(formulaParts.length > 0 && {
      filterByFormula: `AND(${formulaParts.join(",")})`,
    }),
  };

  const records = await base(TABLES.CLIENTS).select(selectOptions).all();

  return records
    .filter((r) => !filters.id || r.id === filters.id)
    .map((r) => ({
      id: r.id,
      name: r.fields["Name"] || "",
      email: r.fields["Email"] || "",
      domain: r.fields["Domain"] || "",
      status: r.fields["Status"] || "",
      plan: r.fields["Plan"] || "",
      keywords: r.fields["Keywords"] || [],
    }));
}

/**
 * Save an audit result to Airtable.
 * @param {object} auditData
 * @returns {Promise<string>} Created record ID
 */
async function saveAuditResult(auditData) {
  const record = await base(TABLES.AUDITS).create({
    Client: [auditData.clientId],
    "Audit Date": new Date().toISOString().split("T")[0],
    "Overall Score": auditData.scores?.overall ?? 0,
    "Visibility Score": auditData.scores?.visibility ?? 0,
    "Citation Rate": auditData.scores?.citationRate ?? 0,
    "Content Relevance": auditData.scores?.contentRelevance ?? 0,
    "Raw Results": JSON.stringify(auditData.rawResults || {}),
    Recommendations: (auditData.recommendations || []).join("\n"),
    Status: "completed",
  });

  return record.id;
}

/**
 * Retrieve the most recent audit report for a client.
 * @param {string} clientId - Airtable record ID of the client
 * @returns {Promise<object|null>}
 */
async function getLatestAuditReport(clientId) {
  const records = await base(TABLES.AUDITS)
    .select({
      filterByFormula: `{Client} = "${clientId}"`,
      sort: [{ field: "Audit Date", direction: "desc" }],
      maxRecords: 1,
    })
    .all();

  if (!records || records.length === 0) return null;

  const r = records[0];
  return {
    id: r.id,
    clientId,
    date: r.fields["Audit Date"],
    scores: {
      overall: r.fields["Overall Score"] ?? 0,
      visibility: r.fields["Visibility Score"] ?? 0,
      citationRate: r.fields["Citation Rate"] ?? 0,
      contentRelevance: r.fields["Content Relevance"] ?? 0,
    },
    recommendations: (r.fields["Recommendations"] || "")
      .split("\n")
      .filter(Boolean),
    rawResults: JSON.parse(r.fields["Raw Results"] || "{}"),
  };
}

/**
 * Retrieve all audit records for a client (for dashboard history).
 * @param {string} clientId
 * @returns {Promise<Array>}
 */
async function getAuditHistory(clientId) {
  const records = await base(TABLES.AUDITS)
    .select({
      filterByFormula: `{Client} = "${clientId}"`,
      sort: [{ field: "Audit Date", direction: "desc" }],
    })
    .all();

  return records.map((r) => ({
    id: r.id,
    date: r.fields["Audit Date"],
    overallScore: r.fields["Overall Score"] ?? 0,
    visibilityScore: r.fields["Visibility Score"] ?? 0,
    citationRate: r.fields["Citation Rate"] ?? 0,
    contentRelevance: r.fields["Content Relevance"] ?? 0,
  }));
}

module.exports = {
  getClients,
  saveAuditResult,
  getLatestAuditReport,
  getAuditHistory,
};
