"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { format } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/it";
import type { Locale } from "@/i18n/routing";
import { buildLyriaPrompt } from "@/server/music/prompt";
import { GENRE_PROMPT, SECTION_IDS, STEP_IDS } from "./catalog";
import { creditsFor } from "./costs";
import {
  clearDraft,
  getDraftSnapshot,
  getServerDraftSnapshot,
  isInstrumental,
  PROMPT_KEYS,
  subscribeDraft,
  toSongSpec,
  writeDraft,
  type ProviderOption,
} from "./draft";
import {
  EnergyStep,
  GenreStep,
  IdeaStep,
  InstrumentsStep,
  LanguageStep,
  LyricsStep,
  MoodStep,
  StructureStep,
  SummaryStep,
  TempoStep,
  VoiceStep,
  type Update,
} from "./steps";

type Props = { locale: Locale; dict: Dictionary; providers: ProviderOption[] };
type Busy = "lyrics" | "submit" | null;

function apiErrorMessage(dict: Dictionary, code: string | undefined): string {
  const messages = dict.apiErrors as Record<string, string>;
  return (code && messages[code]) || dict.apiErrors.GENERIC;
}

export function Wizard({ locale, dict, providers }: Props) {
  const router = useRouter();
  const draft = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getServerDraftSnapshot);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [lyricsError, setLyricsError] = useState(false);

  // Changing a prompt-relevant choice drops a hand-edited prompt, so it cannot silently go stale.
  const update: Update = (patch) => {
    const next = { ...getDraftSnapshot(), ...patch };
    if (!("promptOverride" in patch) && Object.keys(patch).some((key) => PROMPT_KEYS.has(key))) {
      next.promptOverride = null;
    }
    writeDraft(next);
  };

  const instrumental = isInstrumental(draft);
  const steps = STEP_IDS.filter((id) => !(id === "lyrics" && instrumental));
  const position = Math.min(index, steps.length - 1);
  const current = steps[position];
  const isLast = position === steps.length - 1;

  const available = providers.filter((provider) => provider.durations.includes(draft.durationMode));
  const selected = available.find((provider) => provider.id === draft.providerId) ?? available[0];
  const credits = selected ? creditsFor(selected.costCents[draft.durationMode]) : 0;
  const builtPrompt = useMemo(() => buildLyriaPrompt(toSongSpec(draft)), [draft]);
  const prompt = draft.promptOverride ?? builtPrompt;

  async function requestLyrics(): Promise<string> {
    const response = await fetch("/api/lyrics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idea: draft.idea.trim() || undefined,
        genre: GENRE_PROMPT[draft.genre],
        mood: draft.mood,
        voice: draft.voice,
        language: draft.language,
        sections: SECTION_IDS.filter((id) => draft.sections.includes(id)),
      }),
    });
    if (!response.ok) throw new Error(`lyrics ${response.status}`);
    const data = (await response.json()) as { lyrics: string };
    return data.lyrics;
  }

  async function generateLyricsForEditing() {
    setBusy("lyrics");
    setLyricsError(false);
    try {
      update({ lyrics: await requestLyrics() });
    } catch {
      setLyricsError(true);
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!selected) return;
    setBusy("submit");
    setError(null);

    let lyrics = draft.lyrics.trim() || undefined;
    if (!instrumental && draft.lyricsMode === "ai" && !lyrics) {
      // If the lyrics service fails, the song still goes ahead: the music model writes the lyrics.
      try {
        lyrics = (await requestLyrics()).trim() || undefined;
      } catch {
        lyrics = undefined;
      }
    }

    try {
      const response = await fetch("/api/songs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim() || undefined,
          prompt,
          lyrics: instrumental ? undefined : lyrics,
          instrumental,
          durationMode: draft.durationMode,
          providerId: selected.id,
        }),
      });
      if (response.status === 201) {
        const data = (await response.json()) as { id: string };
        clearDraft();
        router.push(`/${locale}/songs/${data.id}`);
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(apiErrorMessage(dict, data.error));
    } catch {
      setError(dict.apiErrors.GENERIC);
    }
    setBusy(null);
  }

  const stepProps = { dict, draft, update };
  let body: ReactNode;
  switch (current) {
    case "idea":
      body = <IdeaStep {...stepProps} />;
      break;
    case "genre":
      body = <GenreStep {...stepProps} />;
      break;
    case "mood":
      body = <MoodStep {...stepProps} />;
      break;
    case "energy":
      body = <EnergyStep {...stepProps} />;
      break;
    case "tempo":
      body = <TempoStep {...stepProps} />;
      break;
    case "voice":
      body = <VoiceStep {...stepProps} />;
      break;
    case "language":
      body = <LanguageStep {...stepProps} />;
      break;
    case "instruments":
      body = <InstrumentsStep {...stepProps} />;
      break;
    case "structure":
      body = <StructureStep {...stepProps} />;
      break;
    case "lyrics":
      body = (
        <LyricsStep
          {...stepProps}
          generating={busy === "lyrics"}
          lyricsError={lyricsError}
          onGenerate={generateLyricsForEditing}
        />
      );
      break;
    default:
      body = (
        <SummaryStep
          {...stepProps}
          providers={providers}
          providerId={selected?.id ?? ""}
          prompt={prompt}
          credits={credits}
          busy={busy === "submit"}
          error={error}
          onSubmit={submit}
        />
      );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-sm font-medium uppercase tracking-wide text-violet-300">{dict.wizard.title}</h1>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-zinc-400">
          <span>{format(dict.wizard.stepOf, { current: position + 1, total: steps.length })}</span>
          <span>{dict.wizard.steps[current]}</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={position + 1}
          className="h-1.5 overflow-hidden rounded-full bg-zinc-800"
        >
          <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${((position + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <section aria-live="polite">{body}</section>

      {!isLast && (
        <nav className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIndex(position - 1)}
            disabled={position === 0}
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-900 disabled:opacity-40"
          >
            {dict.wizard.back}
          </button>
          <button
            type="button"
            onClick={() => setIndex(position + 1)}
            className="rounded-full bg-violet-500 px-6 py-2 text-sm font-medium text-white hover:bg-violet-400"
          >
            {dict.wizard.next}
          </button>
        </nav>
      )}
      {isLast && position > 0 && (
        <button
          type="button"
          onClick={() => setIndex(position - 1)}
          className="w-fit rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-900"
        >
          {dict.wizard.back}
        </button>
      )}
    </div>
  );
}
