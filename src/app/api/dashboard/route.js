/**
 * Neuralis Black — GEO Audit SaaS Platform
 * src/app/api/dashboard/route.js
 *
 * GET /api/dashboard  — Returns aggregated statistics for the admin dashboard.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getClients, getLatestAuditReport } from "@/lib/airtable";

/**
 * GET /api/dashboard
 *
 * Returns:
 *  - totalClients
 *  - activeClients
 *  - averageScore       (across all clients with a recent report)
 *  - clientSummaries    (list of clients with their latest score)
 */
export async function GET(request) {
  try {
    getAuthUser(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }

  try {
    const allClients = await getClients();
    const activeClients = allClients.filter((c) => c.status === "active");

    // Fetch the latest report for each active client in parallel
    const reportResults = await Promise.allSettled(
      activeClients.map((client) => getLatestAuditReport(client.id))
    );

    const clientSummaries = activeClients.map((client, idx) => {
      const result = reportResults[idx];
      const report =
        result.status === "fulfilled" ? result.value : null;

      return {
        id: client.id,
        name: client.name,
        domain: client.domain,
        plan: client.plan,
        latestScore: report?.scores?.overall ?? null,
        lastAuditDate: report?.date ?? null,
      };
    });

    const scored = clientSummaries.filter(
      (s) => typeof s.latestScore === "number"
    );
    const averageScore =
      scored.length > 0
        ? Math.round(
            scored.reduce((sum, s) => sum + s.latestScore, 0) / scored.length
          )
        : null;

    return NextResponse.json({
      success: true,
      data: {
        totalClients: allClients.length,
        activeClients: activeClients.length,
        averageScore,
        clientSummaries,
      },
    });
  } catch (err) {
    console.error("[GET /api/dashboard] Error:", err);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
