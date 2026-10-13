"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/it";
import type { Locale } from "@/i18n/routing";
import { inputClass } from "@/features/wizard/ui";
import { VARIATIONS, type Variation } from "@/server/songs/variations";

type Props = {
  songId: string;
  locale: Locale;
  dict: Dictionary;
  title: string;
  favorite: boolean;
  shareToken: string | null;
  ready: boolean;
  finished: boolean;
  purged: boolean;
  onRenamed: (title: string) => void;
};

type ApiResult = { ok: boolean; data: Record<string, unknown> | null };

async function call(method: string, url: string, body?: unknown): Promise<ApiResult> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : ((await response.json().catch(() => null)) as Record<string, unknown> | null);
  return { ok: response.ok, data };
}

export function SongActions({ songId, locale, dict, title, favorite, shareToken, ready, finished, purged, onRenamed }: Props) {
  const router = useRouter();
  const [currentTitle, setCurrentTitle] = useState(title);
  const [draftTitle, setDraftTitle] = useState(title);
  const [renaming, setRenaming] = useState(false);
  const [isFavorite, setIsFavorite] = useState(favorite);
  const [token, setToken] = useState(shareToken);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const errorText = (data: Record<string, unknown> | null): string => {
    const code = typeof data?.error === "string" ? data.error : undefined;
    const messages = dict.apiErrors as Record<string, string>;
    return (code && messages[code]) || dict.songActions.error;
  };

  // Runs one action at a time and turns any failure into a message, never a crash.
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch {
      setMessage(dict.songActions.error);
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = () =>
    run(async () => {
      const result = await call("PATCH", `/api/songs/${songId}`, { favorite: !isFavorite });
      if (!result.ok) return setMessage(errorText(result.data));
      setIsFavorite(!isFavorite);
    });

  const saveTitle = () =>
    run(async () => {
      const value = draftTitle.trim();
      if (!value) return;
      const result = await call("PATCH", `/api/songs/${songId}`, { title: value });
      if (!result.ok) return setMessage(errorText(result.data));
      setCurrentTitle(value);
      onRenamed(value);
      setRenaming(false);
    });

  const enableShare = () =>
    run(async () => {
      const result = await call("POST", `/api/songs/${songId}/share`);
      if (!result.ok) return setMessage(errorText(result.data));
      setToken(typeof result.data?.token === "string" ? result.data.token : null);
    });

  const disableShare = () =>
    run(async () => {
      const result = await call("DELETE", `/api/songs/${songId}/share`);
      if (!result.ok) return setMessage(errorText(result.data));
      setToken(null);
    });

  const copyLink = async () => {
    if (!token) return;
    const url = `${window.location.origin}/${locale}/s/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage(dict.songActions.copied);
    } catch {
      setMessage(url);
    }
  };

  const regenerate = (variation: Variation) =>
    run(async () => {
      const result = await call("POST", `/api/songs/${songId}/regenerate`, { variation });
      if (!result.ok) return setMessage(errorText(result.data));
      router.push(`/${locale}/songs/${String(result.data?.id)}`);
    });

  const remove = () =>
    run(async () => {
      const result = await call("DELETE", `/api/songs/${songId}`);
      if (!result.ok) return setMessage(errorText(result.data));
      router.push(`/${locale}/library`);
    });

  const buttonClass =
    "rounded-full border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900 disabled:opacity-50";

  return (
    <section className="space-y-5 rounded-3xl border border-zinc-800 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {renaming ? (
          <>
            <label htmlFor="rename-title" className="sr-only">
              {dict.songActions.renameLabel}
            </label>
            <input
              id="rename-title"
              value={draftTitle}
              maxLength={80}
              onChange={(event) => setDraftTitle(event.target.value)}
              className={`${inputClass} sm:w-72`}
            />
            <button type="button" onClick={saveTitle} disabled={busy} className={buttonClass}>
              {dict.songActions.save}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftTitle(currentTitle);
                setRenaming(false);
              }}
              className={buttonClass}
            >
              {dict.songActions.cancel}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setRenaming(true)} className={buttonClass}>
            {dict.songActions.rename}
          </button>
        )}
        <button type="button" aria-pressed={isFavorite} onClick={toggleFavorite} disabled={busy} className={buttonClass}>
          {isFavorite ? dict.songActions.unfavorite : dict.songActions.favorite}
        </button>
      </div>

      {ready && !purged && (
        <div className="space-y-2">
          {token ? (
            <>
              <p className="text-sm text-zinc-400">
                {dict.songActions.shareLabel}:{" "}
                <span className="break-all text-zinc-200">{`/${locale}/s/${token}`}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copyLink} className={buttonClass}>
                  {dict.songActions.copy}
                </button>
                <button type="button" onClick={disableShare} disabled={busy} className={buttonClass}>
                  {dict.songActions.unshare}
                </button>
              </div>
            </>
          ) : (
            <button type="button" onClick={enableShare} disabled={busy} className={buttonClass}>
              {dict.songActions.share}
            </button>
          )}
        </div>
      )}

      {purged && <p className="text-sm text-amber-200">{dict.songActions.purgedNotice}</p>}

      {finished && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-300">{dict.songActions.regenerate}</p>
          <p className="text-xs text-zinc-400">{dict.songActions.regenerateHint}</p>
          <div className="flex flex-wrap gap-2">
            {VARIATIONS.map((variation) => (
              <button key={variation} type="button" onClick={() => regenerate(variation)} disabled={busy} className={buttonClass}>
                {dict.songActions.variations[variation]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4">
        {confirmDelete ? (
          <>
            <p className="text-sm text-red-200">{dict.songActions.deleteConfirm}</p>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {dict.songActions.deleteYes}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className={buttonClass}>
              {dict.songActions.cancel}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-red-300 underline">
            {dict.songActions.delete}
          </button>
        )}
      </div>

      {message && (
        <p role="status" aria-live="polite" className="text-sm text-zinc-300">
          {message}
        </p>
      )}
      <span className="sr-only">{currentTitle}</span>
    </section>
  );
}
