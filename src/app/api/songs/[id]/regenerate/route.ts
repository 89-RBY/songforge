import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/dal";
import { getDb } from "@/server/db";
import { songErrorResponse } from "@/server/http/errors";
import { getMusicProviders } from "@/server/music/registry";
import { getPromptClassifier } from "@/server/moderation";
import { createVariation } from "@/server/songs/service";
import { RULES } from "@/server/ratelimit/rules";
import { checkLimits, rateLimitedResponse } from "@/server/ratelimit/guard";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }

  const db = getDb();
  const retryAfter = await checkLimits(db, [{ rule: RULES.songsPerUser, subject: user.id }]);
  if (retryAfter !== null) return rateLimitedResponse(retryAfter);

  const { id } = await params;
  try {
    const body: unknown = await request.json().catch(() => null);
    const song = await createVariation({ db, providers: getMusicProviders(), classifier: getPromptClassifier() }, user.id, id, body);
    return NextResponse.json({ id: song.id, status: song.status }, { status: 201 });
  } catch (error) {
    const response = songErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
