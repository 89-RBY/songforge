"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SongCover } from "@/features/wizard/Cover";
import type { Dictionary } from "@/i18n/dictionaries/it";
import type { Locale } from "@/i18n/routing";
import { SongActions } from "./SongActions";
import { SongPlayer } from "./SongPlayer";

export type SongSnapshot = {
  id: string;
  title: string;
  status: "QUEUED" | "GENERATING" | "READY" | "FAILED";
  lyrics: string | null;
  audioUrl: string | null;
  errorMessage: string | null;
  durationMode: "CLIP" | "SONG";
  instrumental: boolean;
  mood: string | null;
  energy: number | null;
  favorite: boolean;
  shareToken: string | null;
  audioPurged: boolean;
};

const POLL_MS = 2000;
const TERMINAL = new Set<SongSnapshot["status"]>(["READY", "FAILED"]);

// Polls the song until it is READY or FAILED. A failed poll is simply retried on the next tick.
export function SongView({ dict, initial, locale }: { dict: Dictionary; initial: SongSnapshot; locale: Locale }) {
  const [song, setSong] = useState(initial);

  useEffect(() => {
    if (TERMINAL.has(song.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/songs/${song.id}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as Partial<SongSnapshot>;
        setSong((previous) => ({ ...previous, ...data }));
      } catch {
        // Network hiccup: the next tick tries again.
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [song.id, song.status]);

  const inProgress = !TERMINAL.has(song.status);
  const playable = song.status === "READY" && song.audioUrl !== null && !song.audioPurged;

  return (
    <section className="space-y-6">
      <nav>
        <Link href={`/${locale}/library`} className="text-sm text-violet-300 underline">
          {dict.songActions.back}
        </Link>
      </nav>

      <div className="flex items-start gap-4">
        <SongCover mood={song.mood} energy={song.energy} label="" size="sm" />
        <div className="min-w-0 space-y-2">
          <p className="text-sm text-violet-300">{dict.song.title}</p>
          <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{song.title}</h1>
          <p role="status" aria-live="polite" className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1 text-sm">
            {inProgress && <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />}
            {dict.song.status[song.status]}
          </p>
        </div>
      </div>

      {inProgress && <p className="text-zinc-400">{dict.song.waiting}</p>}

      {song.status === "FAILED" && (
        <div className="space-y-4">
          <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {song.errorMessage ?? dict.apiErrors.GENERIC}
          </p>
          <Link href={`/${locale}/create`} className="inline-block rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-900">
            {dict.song.createAnother}
          </Link>
        </div>
      )}

      {playable && song.audioUrl && (
        <div className="space-y-3">
          <SongPlayer src={song.audioUrl} dict={dict} />
          <div className="flex flex-wrap items-center gap-3">
            <a href={song.audioUrl} download className="rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-900">
              {dict.song.download}
            </a>
            <Link href={`/${locale}/create`} className="rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-900">
              {dict.song.createAnother}
            </Link>
          </div>
          <p className="text-xs text-zinc-400">{dict.common.aiGenerated}</p>
        </div>
      )}

      {song.lyrics && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-300">{dict.song.lyrics}</h2>
          <pre className="whitespace-pre-wrap font-sans text-zinc-300">{song.lyrics}</pre>
        </div>
      )}

      <SongActions
        songId={song.id}
        locale={locale}
        dict={dict}
        title={song.title}
        favorite={song.favorite}
        shareToken={song.shareToken}
        ready={song.status === "READY"}
        finished={song.status === "READY" || song.status === "FAILED"}
        purged={song.audioPurged}
        onRenamed={(title) => setSong((previous) => ({ ...previous, title }))}
      />
    </section>
  );
}
