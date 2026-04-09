#!/usr/bin/env node
/**
 * Neuralis Black — GEO Audit SaaS Platform
 * Script: run-audit.js
 *
 * Runs a GEO (Generative Engine Optimization) audit for one or all clients.
 * Usage: node scripts/run-audit.js [clientId]
 */

require("dotenv").config({ path: ".env.local" });
const { runAuditForClient, runAuditForAllClients } = require("../src/lib/audit-engine");
const { getClients } = require("../src/lib/airtable");

async function main() {
  const clientId = process.argv[2];

  try {
    if (clientId) {
      console.log(`\n🔍 Running GEO audit for client: ${clientId}\n`);
      const result = await runAuditForClient(clientId);
      console.log("✅ Audit complete:", JSON.stringify(result, null, 2));
    } else {
      console.log("\n🔍 Running GEO audits for all active clients…\n");
      const clients = await getClients({ status: "active" });

      if (!clients || clients.length === 0) {
        console.log("No active clients found.");
        process.exit(0);
      }

      console.log(`Found ${clients.length} active client(s). Starting audits…\n`);
      const results = await runAuditForAllClients(clients);

      const passed = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      console.log(`\n📊 Audit Summary:`);
      console.log(`   ✅ Passed : ${passed}`);
      console.log(`   ❌ Failed : ${failed}`);
      console.log(`   📋 Total  : ${results.length}`);
    }
  } catch (err) {
    console.error("❌ Audit script failed:", err.message);
    process.exit(1);
  }
}

main();
