import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { getDb } from "@/server/db";
import { getMusicProviders } from "@/server/music/registry";
import { createSong, SongServiceError } from "@/server/songs/service";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  try {
    const song = await createSong({ db: getDb(), providers: getMusicProviders() }, user.id, body);
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
    if (error instanceof SongServiceError) {
      const status = error.code === "TOO_MANY_ACTIVE" ? 429 : 422;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    throw error;
  }
}
