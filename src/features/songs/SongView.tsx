"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/it";

export type SongSnapshot = {
  id: string;
  title: string;
  status: "QUEUED" | "GENERATING" | "READY" | "FAILED";
  lyrics: string | null;
  audioUrl: string | null;
  errorMessage: string | null;
  durationMode: "CLIP" | "SONG";
  instrumental: boolean;
};

const POLL_MS = 2000;
const TERMINAL = new Set<SongSnapshot["status"]>(["READY", "FAILED"]);

// Polls the song until it is READY or FAILED. A failed poll is simply retried on the next tick.
export function SongView({ dict, initial, createHref }: { dict: Dictionary; initial: SongSnapshot; createHref: string }) {
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

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-violet-300">{dict.song.title}</p>
        <h1 className="break-words text-3xl font-bold tracking-tight">{song.title}</h1>
        <p role="status" aria-live="polite" className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1 text-sm">
          {inProgress && <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />}
          {dict.song.status[song.status]}
        </p>
      </div>

      {inProgress && <p className="text-zinc-400">{dict.song.waiting}</p>}

      {song.status === "FAILED" && (
        <div className="space-y-4">
          <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {song.errorMessage ?? dict.apiErrors.GENERIC}
          </p>
          <a href={createHref} className="inline-block rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-900">
            {dict.song.createAnother}
          </a>
        </div>
      )}

      {song.status === "READY" && song.audioUrl && (
        <div className="space-y-4">
          <audio controls preload="metadata" src={song.audioUrl} aria-label={dict.song.audioLabel} className="w-full" />
          <div className="flex flex-wrap gap-3">
            <a href={song.audioUrl} download className="rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-900">
              {dict.song.download}
            </a>
            <a href={createHref} className="rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-900">
              {dict.song.createAnother}
            </a>
          </div>
          <p className="text-xs text-zinc-500">{dict.common.aiGenerated}</p>
        </div>
      )}

      {song.lyrics && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-300">{dict.song.lyrics}</h2>
          <pre className="whitespace-pre-wrap font-sans text-zinc-300">{song.lyrics}</pre>
        </div>
      )}
    </section>
  );
}
