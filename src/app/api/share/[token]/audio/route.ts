import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { getAudioStorage } from "@/server/storage";
import { getSharedSong } from "@/server/songs/service";

// Public on purpose: anyone with the link can listen. Only the audio is served, nothing else about the song.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const song = await getSharedSong(getDb(), token);
  if (!song) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (song.audioPurgedAt || !song.audioKey) return NextResponse.json({ error: "PURGED" }, { status: 410 });

  const audio = await getAudioStorage().get(song.audioKey);
  if (!audio) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return new Response(Buffer.from(audio.data), {
    headers: {
      "content-type": audio.mimeType,
      "content-length": String(audio.data.byteLength),
      "cache-control": "public, max-age=300",
    },
  });
}
