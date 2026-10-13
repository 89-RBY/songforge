import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { getDb } from "@/server/db";
import { getMusicProviders } from "@/server/music/registry";
import { RULES } from "@/server/ratelimit/rules";
import { checkLimits, rateLimitedResponse } from "@/server/ratelimit/guard";
import { clientIp } from "@/server/http/client-ip";
import { songErrorResponse } from "@/server/http/errors";
import { getPromptClassifier } from "@/server/moderation";
import { createSong } from "@/server/songs/service";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }

  const db = getDb();
  const ip = clientIp(request.headers);
  const retryAfter = await checkLimits(db, [
    { rule: RULES.songsPerUser, subject: user.id },
    ...(ip ? [{ rule: RULES.songsPerIp, subject: ip }] : []),
  ]);
  if (retryAfter !== null) return rateLimitedResponse(retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  try {
    const song = await createSong({ db, providers: getMusicProviders(), classifier: getPromptClassifier() }, user.id, body);
    return NextResponse.json({ id: song.id, status: song.status }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "VALIDATION",
          issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
        { status: 400 },
      );
    }
    const response = songErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
