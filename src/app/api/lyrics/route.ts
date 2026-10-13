import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { getLyricsProvider } from "@/server/lyrics";
import { LyricsError } from "@/server/lyrics/types";
import { checkPrompt } from "@/server/moderation/prompt";
import { getDb } from "@/server/db";
import { RULES } from "@/server/ratelimit/rules";
import { checkLimits, rateLimitedResponse } from "@/server/ratelimit/guard";

const lyricsInput = z.object({
  idea: z.string().trim().max(500).optional(),
  genre: z.string().trim().min(1).max(40),
  mood: z.string().trim().min(1).max(40),
  voice: z.enum(["male", "female", "duet", "choir"]),
  language: z.string().min(2).max(5),
  sections: z.array(z.enum(["intro", "verse", "chorus", "bridge", "outro"])).min(1).max(8),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }

  const retryAfter = await checkLimits(getDb(), [{ rule: RULES.lyricsPerUser, subject: user.id }]);
  if (retryAfter !== null) return rateLimitedResponse(retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  let input;
  try {
    input = lyricsInput.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "VALIDATION", issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) },
        { status: 400 },
      );
    }
    throw error;
  }

  if (input.idea && !checkPrompt(input.idea).allowed) {
    return NextResponse.json({ error: "MODERATION_BLOCKED" }, { status: 422 });
  }

  const provider = getLyricsProvider();
  if (!provider) return NextResponse.json({ error: "LYRICS_UNAVAILABLE" }, { status: 503 });

  try {
    const lyrics = await provider.generate(input);
    return NextResponse.json({ lyrics });
  } catch (error) {
    if (error instanceof LyricsError) {
      return NextResponse.json({ error: "LYRICS_FAILED", code: error.code }, { status: 502 });
    }
    throw error;
  }
}
