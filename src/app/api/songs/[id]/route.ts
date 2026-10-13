import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/dal";
import { songErrorResponse } from "@/server/http/errors";
import { getDb } from "@/server/db";
import { getAudioStorage } from "@/server/storage";
import { deleteSong, getSongForUser, updateSong } from "@/server/songs/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await params;
  const song = await getSongForUser(getDb(), user.id, id);
  if (!song) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({
    id: song.id,
    title: song.title,
    status: song.status,
    durationMode: song.durationMode,
    instrumental: song.instrumental,
    providerId: song.providerId,
    durationSeconds: song.durationSeconds,
    lyrics: song.generatedLyrics ?? song.lyrics ?? null,
    errorCode: song.errorCode,
    errorMessage: song.errorMessage,
    mood: song.mood,
    energy: song.energy,
    genre: song.genre,
    coverHue: song.coverHue,
    favorite: song.favorite,
    shareToken: song.shareToken,
    audioPurged: song.audioPurgedAt !== null,
    variationOf: song.variationOf,
    audioUrl: song.status === "READY" && !song.audioPurgedAt ? `/api/songs/${song.id}/audio` : null,
    createdAt: song.createdAt,
    completedAt: song.completedAt,
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }

  const { id } = await params;
  try {
    const body: unknown = await request.json().catch(() => null);
    const song = await updateSong(getDb(), user.id, id, body);
    return NextResponse.json({ id: song.id, title: song.title, favorite: song.favorite });
  } catch (error) {
    const response = songErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await params;
  try {
    await deleteSong(getDb(), getAudioStorage(), user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const response = songErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
