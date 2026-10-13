import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/server/auth/dal";
import { adjustCredits } from "@/server/admin/users";
import { getDb } from "@/server/db";
import { adminErrorResponse } from "@/server/http/admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }
  const { id } = await params;
  try {
    const balance = await adjustCredits(getDb(), admin.id, id, await request.json().catch(() => null));
    return NextResponse.json({ balance });
  } catch (error) {
    const response = adminErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
