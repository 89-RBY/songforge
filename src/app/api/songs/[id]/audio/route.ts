import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/dal";
import { getDb } from "@/server/db";
import { getAudioStorage } from "@/server/storage";
import { getSongForUser } from "@/server/songs/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await params;
  const song = await getSongForUser(getDb(), user.id, id);
  if (!song || song.status !== "READY" || !song.audioKey) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const audio = await getAudioStorage().get(song.audioKey);
  if (!audio) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const extension = song.audioKey.slice(song.audioKey.lastIndexOf(".") + 1);
  return new Response(Buffer.from(audio.data), {
    headers: {
      "content-type": audio.mimeType,
      "content-length": String(audio.data.byteLength),
      "cache-control": "private, max-age=3600",
      "content-disposition": `inline; filename="${song.id}.${extension}"`,
    },
  });
}
