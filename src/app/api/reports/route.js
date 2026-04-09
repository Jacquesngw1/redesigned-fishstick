/**
 * Neuralis Black — GEO Audit SaaS Platform
 * src/app/api/reports/route.js
 *
 * GET /api/reports?clientId=<id>  — Retrieve the latest audit report for a client.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getLatestAuditReport } from "@/lib/airtable";
import { getGrade } from "@/lib/scoring";

/**
 * GET /api/reports?clientId=<id>
 */
export async function GET(request) {
  try {
    getAuthUser(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json(
      { error: "clientId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const report = await getLatestAuditReport(clientId);

    if (!report) {
      return NextResponse.json(
        { error: "No audit report found for this client" },
        { status: 404 }
      );
    }

    // Annotate scores with letter grades
    const annotatedScores = Object.fromEntries(
      Object.entries(report.scores).map(([key, value]) => [
        key,
        { score: value, ...getGrade(value) },
      ])
    );

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        scores: annotatedScores,
      },
    });
  } catch (err) {
    console.error("[GET /api/reports] Error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve report" },
      { status: 500 }
    );
  }
}
