import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/dal";
import { getDb } from "@/server/db";
import { getSongForUser } from "@/server/songs/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    audioUrl: song.status === "READY" ? `/api/songs/${song.id}/audio` : null,
    createdAt: song.createdAt,
    completedAt: song.completedAt,
  });
}
