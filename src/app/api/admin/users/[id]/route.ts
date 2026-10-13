import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/server/auth/dal";
import { getDb } from "@/server/db";
import { adminErrorResponse } from "@/server/http/admin";
import { setBlocked } from "@/server/admin/users";

type Params = { params: Promise<{ id: string }> };

// Blocks or unblocks a user. A blocked user is signed out on the next request.
export async function PATCH(request: Request, { params }: Params) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }
  const { id } = await params;
  try {
    await setBlocked(getDb(), admin.id, id, await request.json().catch(() => null));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = adminErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
