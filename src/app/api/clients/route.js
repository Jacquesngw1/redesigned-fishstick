/**
 * Neuralis Black — GEO Audit SaaS Platform
 * src/app/api/clients/route.js
 *
 * GET  /api/clients           — List all clients (with optional status filter)
 * GET  /api/clients?id=<id>   — Get a specific client
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getClients } from "@/lib/airtable";

/**
 * GET /api/clients
 * Query params:
 *   status  — Filter by client status (e.g. "active", "inactive")
 *   id      — Filter by specific client record ID
 */
export async function GET(request) {
  try {
    getAuthUser(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const id = searchParams.get("id") || undefined;

  const filters = {};
  if (status) filters.status = status;
  if (id) filters.id = id;

  try {
    const clients = await getClients(filters);
    return NextResponse.json({ success: true, data: clients });
  } catch (err) {
    console.error("[GET /api/clients] Error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve clients" },
      { status: 500 }
    );
  }
}
