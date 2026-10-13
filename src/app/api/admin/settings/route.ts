import { NextResponse } from "next/server";
import { recordAudit } from "@/server/admin/audit";
import { getCurrentAdmin } from "@/server/auth/dal";
import { getDb } from "@/server/db";
import { adminErrorResponse } from "@/server/http/admin";
import { savePricing } from "@/server/pricing/settings";

// Replaces the pricing settings. Past charges are not affected: each ledger row keeps its own amounts.
export async function PUT(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }
  const db = getDb();
  try {
    const pricing = await savePricing(db, await request.json().catch(() => null));
    await recordAudit(db, admin.id, "SETTINGS_UPDATED", null, pricing);
    return NextResponse.json({ pricing });
  } catch (error) {
    const response = adminErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
