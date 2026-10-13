"use client";

import { format } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/it";
import {
  GENRE_ICONS,
  GENRE_IDS,
  INSTRUMENT_IDS,
  LANGUAGES,
  LYRICS_MODES,
  MOOD_HUE,
  MOOD_IDS,
  SECTION_IDS,
  TEMPLATE_IDS,
  TIMBRE_IDS,
  VOICE_IDS,
} from "./catalog";
import { SongCover } from "./Cover";
import { isInstrumental, type Draft, type ProviderOption } from "./draft";
import { Chip, inputClass, OptionCard, StepTitle } from "./ui";

export type Update = (patch: Partial<Draft>) => void;
export type StepProps = { dict: Dictionary; draft: Draft; update: Update };

export function IdeaStep({ dict, draft, update }: StepProps) {
  const t = dict.wizard.idea;
  return (
    <div className="space-y-6">
      <StepTitle>{t.title}</StepTitle>
      <label htmlFor="idea" className="sr-only">
        {t.title}
      </label>
      <textarea
        id="idea"
        rows={3}
        maxLength={500}
        value={draft.idea}
        placeholder={t.placeholder}
        onChange={(event) => update({ idea: event.target.value, templateId: null })}
        className={inputClass}
      />
      <p className="text-sm text-zinc-400">{t.hint}</p>
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-300">{t.templatesTitle}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TEMPLATE_IDS.map((id) => (
            <OptionCard
              key={id}
              selected={draft.templateId === id}
              onSelect={() => update({ templateId: id, idea: t.templates[id].idea })}
            >
              {t.templates[id].label}
            </OptionCard>
          ))}
          <OptionCard
            selected={draft.templateId === null && draft.idea === ""}
            onSelect={() => update({ templateId: null, idea: "" })}
          >
            {t.blank}
          </OptionCard>
        </div>
      </div>
    </div>
  );
}

export function GenreStep({ dict, draft, update }: StepProps) {
  const t = dict.wizard.genre;
  return (
    <div className="space-y-6">
      <StepTitle>{t.title}</StepTitle>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {GENRE_IDS.map((id) => (
          <OptionCard key={id} selected={draft.genre === id} onSelect={() => update({ genre: id })} icon={GENRE_ICONS[id]}>
            {t.options[id]}
          </OptionCard>
        ))}
      </div>
      <div>
        <label htmlFor="subgenre" className="mb-2 block text-sm font-medium text-zinc-300">
          {t.subgenreLabel}
        </label>
        <input
          id="subgenre"
          type="text"
          maxLength={60}
          value={draft.subgenre}
          placeholder={t.subgenrePlaceholder}
          onChange={(event) => update({ subgenre: event.target.value })}
          className={inputClass}
        />
      </div>
    </div>
  );
}

export function MoodStep({ dict, draft, update }: StepProps) {
  const t = dict.wizard.mood;
  return (
    <div className="space-y-6">
      <StepTitle>{t.title}</StepTitle>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {MOOD_IDS.map((id) => (
          <OptionCard
            key={id}
            selected={draft.mood === id}
            onSelect={() => update({ mood: id })}
            icon={
              <span
                className="block h-7 w-7 rounded-full"
                style={{ background: `hsl(${MOOD_HUE[id]} 85% 55%)` }}
              />
            }
          >
            {t.options[id]}
          </OptionCard>
        ))}
      </div>
    </div>
  );
}

export function EnergyStep({ dict, draft, update }: StepProps) {
  const t = dict.wizard.energy;
  const valueText = format(t.value, { value: draft.energy });
  return (
    <div className="space-y-6">
      <StepTitle>{t.title}</StepTitle>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={draft.energy}
        aria-label={t.title}
        aria-valuetext={valueText}
        onChange={(event) => update({ energy: Number(event.target.value) })}
        className="w-full accent-violet-500"
      />
      <div className="flex justify-between text-sm text-zinc-400">
        <span>{t.low}</span>
        <span>{t.high}</span>
      </div>
      <p className="text-center text-2xl font-semibold">{valueText}</p>
    </div>
  );
}

export function TempoStep({ dict, draft, update }: StepProps) {
  const t = dict.wizard.tempo;
  const manual = draft.bpm !== null;
  return (
    <div className="space-y-6">
      <StepTitle>{t.title}</StepTitle>
      <div className="grid grid-cols-2 gap-2">
        <OptionCard selected={!manual} onSelect={() => update({ bpm: null })}>
          {t.auto}
        </OptionCard>
        <OptionCard selected={manual} onSelect={() => update({ bpm: draft.bpm ?? 110 })}>
          {t.manual}
        </OptionCard>
      </div>
      {manual && (
        <div className="space-y-3">
          <input
            type="range"
            min={60}
            max={200}
            step={1}
            value={draft.bpm ?? 110}
            aria-label={t.title}
            aria-valuetext={format(t.bpm, { bpm: draft.bpm ?? 110 })}
            onChange={(event) => update({ bpm: Number(event.target.value) })}
            className="w-full accent-violet-500"
          />
          <div className="flex justify-between text-sm text-zinc-400">
            <span>{t.slow}</span>
            <span>{t.medium}</span>
            <span>{t.fast}</span>
          </div>
          <p className="text-center text-2xl font-semibold">{format(t.bpm, { bpm: draft.bpm ?? 110 })}</p>
        </div>
      )}
    </div>
  );
}

export function VoiceStep({ dict, draft, update }: StepProps) {
  const t = dict.wizard.voice;
  return (
    <div className="space-y-6">
      <StepTitle>{t.title}</StepTitle>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {VOICE_IDS.map((id) => (
          <OptionCard key={id} selected={draft.voice === id} onSelect={() => update({ voice: id })}>
            {t.options[id]}
          </OptionCard>
        ))}
      </div>
      {!isInstrumental(draft) && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-300">{t.timbreTitle}</p>
          <div className="flex flex-wrap gap-2">
            <Chip selected={draft.timbre === null} onToggle={() => update({ timbre: null })}>
              {t.noTimbre}
            </Chip>
            {TIMBRE_IDS.map((id) => (
              <Chip
                key={id}
                selected={draft.timbre === id}
                onToggle={() => update({ timbre: draft.timbre === id ? null : id })}
              >
                {t.timbres[id]}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LanguageStep({ dict, draft, update }: StepProps) {
  return (
    <div className="space-y-6">
      <StepTitle>{dict.wizard.language.title}</StepTitle>
      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map((language) => (
          <Chip key={language.code} selected={draft.language === language.code} onToggle={() => update({ language: language.code })}>
            {language.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export function InstrumentsStep({ dict, draft, update }: StepProps) {
  const t = dict.wizard.instruments;
  const toggle = (id: (typeof INSTRUMENT_IDS)[number]) =>
    update({
      instruments: draft.instruments.includes(id)
        ? draft.instruments.filter((item) => item !== id)
        : [...draft.instruments, id],
    });
  return (
    <div className="space-y-6">
      <StepTitle>{t.title}</StepTitle>
      <p className="text-sm text-zinc-400">{t.hint}</p>
      <div className="flex flex-wrap gap-2">
        {INSTRUMENT_IDS.map((id) => (
          <Chip key={id} selected={draft.instruments.includes(id)} onToggle={() => toggle(id)}>
            {t.options[id]}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export function StructureStep({ dict, draft, update }: StepProps) {
  const t = dict.wizard.structure;
  const toggleSection = (id: (typeof SECTION_IDS)[number]) => {
    const selected = draft.sections.includes(id);
    // Keep at least one section: an empty structure would fall back to the default without telling the user.
    if (selected && draft.sections.length === 1) return;
    update({ sections: selected ? draft.sections.filter((item) => item !== id) : [...draft.sections, id] });
  };
  return (
    <div className="space-y-6">
      <StepTitle>{t.title}</StepTitle>
      <div className="grid grid-cols-2 gap-2">
        <OptionCard
          selected={draft.durationMode === "CLIP"}
          onSelect={() => update({ durationMode: "CLIP" })}
          description={t.clip.description}
        >
          {t.clip.label}
        </OptionCard>
        <OptionCard
          selected={draft.durationMode === "SONG"}
          onSelect={() => update({ durationMode: "SONG" })}
          description={t.song.description}
        >
          {t.song.label}
        </OptionCard>
      </div>
      {draft.durationMode === "SONG" && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-300">{t.sectionsTitle}</p>
          <div className="flex flex-wrap gap-2">
            {SECTION_IDS.map((id) => (
              <Chip key={id} selected={draft.sections.includes(id)} onToggle={() => toggleSection(id)}>
                {t.sections[id]}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LyricsStep({
  dict,
  draft,
  update,
  generating,
  lyricsError,
  onGenerate,
}: StepProps & { generating: boolean; lyricsError: boolean; onGenerate: () => void }) {
  const t = dict.wizard.lyrics;
  if (isInstrumental(draft)) {
    return (
      <div className="space-y-6">
        <StepTitle>{t.title}</StepTitle>
        <p className="text-zinc-400">{t.instrumentalNote}</p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <StepTitle>{t.title}</StepTitle>
      <div className="grid gap-2">
        {LYRICS_MODES.map((mode) => (
          <OptionCard
            key={mode}
            selected={draft.lyricsMode === mode}
            onSelect={() => update({ lyricsMode: mode })}
            description={t.modes[mode].description}
          >
            {t.modes[mode].label}
          </OptionCard>
        ))}
      </div>
      {draft.lyricsMode === "ai" && <p className="text-sm text-zinc-400">{t.fallbackNote}</p>}
      {draft.lyricsMode !== "ai" && (
        <div className="space-y-3">
          {draft.lyricsMode === "editable" && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating}
              className="rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-900 disabled:opacity-50"
            >
              {generating ? t.generating : t.generate}
            </button>
          )}
          {lyricsError && (
            <p role="alert" className="text-sm text-red-300">
              {t.generateError}
            </p>
          )}
          <label htmlFor="lyrics" className="block text-sm font-medium text-zinc-300">
            {t.textLabel}
          </label>
          <textarea
            id="lyrics"
            rows={8}
            maxLength={4000}
            value={draft.lyrics}
            onChange={(event) => update({ lyrics: event.target.value })}
            className={inputClass}
          />
          <p className="text-sm text-zinc-400">{t.textHint}</p>
        </div>
      )}
    </div>
  );
}

export function SummaryStep({
  dict,
  draft,
  update,
  providers,
  providerId,
  prompt,
  credits,
  balance,
  billingHref,
  busy,
  error,
  onSubmit,
}: StepProps & {
  providers: ProviderOption[];
  providerId: string;
  prompt: string;
  credits: number;
  balance: number;
  billingHref: string;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const t = dict.wizard.summary;
  const preview = dict.wizard.preview;
  const available = providers.filter((provider) => provider.durations.includes(draft.durationMode));
  const durationLabel =
    draft.durationMode === "CLIP" ? dict.wizard.structure.clip.label : dict.wizard.structure.song.label;
  const insufficient = credits > balance;

  return (
    <div className="space-y-6">
      <StepTitle>{t.title}</StepTitle>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-6">
        <SongCover mood={draft.mood} energy={draft.energy} label={preview} />
        <div className="w-full space-y-3">
          <p className="text-sm text-zinc-400">{dict.wizard.previewHint}</p>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-300">
            {t.titleLabel}
          </label>
          <input
            id="title"
            type="text"
            maxLength={80}
            value={draft.title}
            placeholder={t.titlePlaceholder}
            onChange={(event) => update({ title: event.target.value })}
            className={inputClass}
          />
          <p className="text-sm text-zinc-400">
            {t.duration}: {durationLabel}
          </p>
          <p className="text-sm text-zinc-400">
            {t.cost}:{" "}
            {credits > 0 ? (
              <>
                {format(t.credits, { count: credits })} <span className="text-zinc-400">({t.provisional})</span>
              </>
            ) : (
              t.free
            )}
          </p>
          {credits > 0 && (
            <p className="text-sm text-zinc-300">{format(t.balance, { count: balance })}</p>
          )}
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-300">{t.model}</legend>
        {available.length === 0 && <p className="text-sm text-red-300">{t.noModel}</p>}
        <div className="grid gap-2">
          {available.map((provider) => (
            <OptionCard
              key={provider.id}
              selected={providerId === provider.id}
              onSelect={() => update({ providerId: provider.id })}
            >
              {(t.models as Record<string, string>)[provider.id] ?? provider.label}
            </OptionCard>
          ))}
        </div>
      </fieldset>

      <details className="rounded-2xl border border-zinc-800 p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-300">{t.advanced}</summary>
        <div className="mt-3 space-y-2">
          <p className="text-sm text-zinc-400">{t.advancedHint}</p>
          <label htmlFor="prompt" className="sr-only">
            {t.advanced}
          </label>
          <textarea
            id="prompt"
            rows={8}
            value={prompt}
            onChange={(event) => update({ promptOverride: event.target.value })}
            className={`${inputClass} font-mono text-xs`}
          />
          {draft.promptOverride !== null && (
            <button
              type="button"
              onClick={() => update({ promptOverride: null })}
              className="text-sm text-violet-300 underline"
            >
              {t.resetPrompt}
            </button>
          )}
        </div>
      </details>

      <div className="space-y-1 text-xs text-zinc-400">
        <p>{t.aiDisclosure}</p>
        <p>{t.rightsNote}</p>
      </div>

      {insufficient && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p>{t.insufficient}</p>
          <a href={billingHref} className="font-medium underline">
            {t.buyCredits}
          </a>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || available.length === 0 || insufficient}
        className="w-full rounded-full bg-violet-600 px-6 py-3 font-medium text-white hover:bg-violet-600 disabled:opacity-50"
      >
        {busy ? t.submitting : t.submit}
      </button>
    </div>
  );
}
