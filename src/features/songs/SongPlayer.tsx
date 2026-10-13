"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { computePeaks } from "./peaks";

const BARS = 96;

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

// Plays the song with our own controls. The waveform is decoded in the browser from the same file,
// so the server does no audio work. If decoding fails, the controls still play the audio.
export function SongPlayer({ src, dict }: { src: string; dict: Dictionary }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const decode = async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) return;
        const bytes = await response.arrayBuffer();
        const Context = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
        if (!Context) return;
        const context = new Context();
        try {
          const buffer = await context.decodeAudioData(bytes);
          if (!cancelled) setPeaks(computePeaks(buffer.getChannelData(0), BARS));
        } finally {
          await context.close();
        }
      } catch {
        // Not decodable in this browser: the plain controls still work.
      }
    };
    void decode();
    return () => {
      cancelled = true;
    };
  }, [src]);

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrent(seconds);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const onWaveformClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    seekTo(ratio * duration);
  };

  const bars = peaks ?? Array.from({ length: BARS }, () => 0.15);
  const progressText = dict.player.progress
    .replace("{current}", formatTime(current))
    .replace("{total}", formatTime(duration));

  return (
    <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        hidden
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <div
        aria-hidden="true"
        onClick={onWaveformClick}
        className="flex h-20 cursor-pointer items-end gap-[2px]"
        title={peaks ? undefined : dict.player.noWaveform}
      >
        {bars.map((height, index) => {
          const played = duration > 0 && index / BARS < current / duration;
          return (
            <span
              key={index}
              className={`w-full rounded-full ${played ? "bg-violet-400" : "bg-zinc-600"}`}
              style={{ height: `${Math.max(6, height * 100)}%` }}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? dict.player.pause : dict.player.play}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet-600 text-lg text-white hover:bg-violet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
        >
          <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
        </button>
        <p className="text-sm tabular-nums text-zinc-300" aria-live="off">
          {progressText}
        </p>
      </div>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={current}
        onChange={(event) => seekTo(Number(event.target.value))}
        aria-label={dict.player.seek}
        aria-valuetext={progressText}
        className="w-full accent-violet-500"
      />

      <label className="flex items-center gap-3 text-sm text-zinc-400">
        {dict.player.volume}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(event) => {
            const next = Number(event.target.value);
            setVolume(next);
            if (audioRef.current) audioRef.current.volume = next;
          }}
          className="w-full accent-violet-500"
        />
      </label>
    </div>
  );
}
