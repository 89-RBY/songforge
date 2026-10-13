"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "songforge.cookie-notice";

// The dismissal is kept in localStorage (no cookie). If storage is blocked, the notice simply stays visible.
function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(): () => void {
  return () => {};
}

export function CookieNotice({ text, ok, moreLabel, moreHref }: { text: string; ok: string; moreLabel: string; moreHref: string }) {
  const dismissedBefore = useSyncExternalStore(subscribe, readDismissed, () => true);
  const [dismissedNow, setDismissedNow] = useState(false);
  if (dismissedBefore || dismissedNow) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage is blocked: the notice is hidden for this page view only.
    }
    setDismissedNow(true);
  }

  return (
    <div role="region" aria-label={text} className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-700 bg-zinc-900 px-4 py-3 shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 text-sm text-zinc-200 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {text}{" "}
          <Link href={moreHref} className="underline">
            {moreLabel}
          </Link>
        </p>
        <button type="button" onClick={dismiss} className="shrink-0 rounded-full bg-violet-600 px-4 py-1.5 font-medium text-white hover:bg-violet-700">
          {ok}
        </button>
      </div>
    </div>
  );
}
