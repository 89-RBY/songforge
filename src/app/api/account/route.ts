import { NextResponse } from "next/server";
import { z } from "zod";
import { ZodError } from "zod";
import { AccountError, deleteAccount } from "@/server/account/service";
import { getCurrentUser } from "@/server/auth/dal";
import { getDb } from "@/server/db";
import { getAudioStorage } from "@/server/storage";

const deleteInput = z.object({ confirmEmail: z.string().trim().min(1).max(320) });

// Permanently deletes the signed-in account. The body must repeat the account email.
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }

  try {
    const { confirmEmail } = deleteInput.parse(await request.json().catch(() => null));
    await deleteAccount(getDb(), getAudioStorage(), user.id, confirmEmail);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
    if (error instanceof AccountError) {
      const status = error.code === "SONGS_IN_PROGRESS" ? 409 : error.code === "CONFIRM_MISMATCH" ? 422 : 404;
      return NextResponse.json({ error: error.code }, { status });
    }
    throw error;
  }
}
