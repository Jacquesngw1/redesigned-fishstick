/**
 * Neuralis Black — GEO Audit SaaS Platform
 * src/app/api/audit/route.js
 *
 * POST /api/audit  — Trigger a GEO audit for a client.
 * GET  /api/audit  — Retrieve audit history for a client.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { runAuditForClient } from "@/lib/audit-engine";
import { getAuditHistory } from "@/lib/airtable";

/**
 * POST /api/audit
 * Body: { clientId: string }
 */
export async function POST(request) {
  try {
    getAuthUser(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { clientId } = body || {};

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json(
      { error: "clientId is required and must be a string" },
      { status: 400 }
    );
  }

  try {
    const result = await runAuditForClient(clientId);
    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    );
  } catch (err) {
    if (err.message.includes("not found")) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("[POST /api/audit] Error:", err);
    return NextResponse.json(
      { error: "Audit failed. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/audit?clientId=<id>
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
    const history = await getAuditHistory(clientId);
    return NextResponse.json({ success: true, data: history });
  } catch (err) {
    console.error("[GET /api/audit] Error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve audit history" },
      { status: 500 }
    );
  }
}
