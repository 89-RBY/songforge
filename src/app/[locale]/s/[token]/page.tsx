import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SongCover } from "@/features/wizard/Cover";
import { SongPlayer } from "@/features/songs/SongPlayer";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/routing";
import { getDb } from "@/server/db";
import { getSharedSong } from "@/server/songs/service";

// Public page: no login. It shows only the title, the cover and the audio.
async function SharedContent({ token, locale }: { token: string; locale: string }) {
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const song = await getSharedSong(getDb(), token);

  if (!song) return <p className="text-zinc-400">{dict.shared.notFound}</p>;
  if (song.audioPurgedAt) return <p className="text-zinc-400">{dict.shared.purged}</p>;

  return (
    <section className="space-y-6">
      <p className="text-sm text-violet-300">{dict.shared.title}</p>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <SongCover mood={song.mood} energy={song.energy} label={song.title} size="lg" />
        <div className="w-full min-w-0 space-y-4">
          <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{song.title}</h1>
          <SongPlayer src={`/api/share/${token}/audio`} dict={dict} />
        </div>
      </div>
      <p className="text-xs text-zinc-400">{dict.shared.madeWith}</p>
    </section>
  );
}

async function SharedPageContent({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <span className="font-semibold tracking-tight">{dict.meta.title}</span>
      </header>
      <Suspense fallback={<p className="text-zinc-400">{dict.common.loading}</p>}>
        <SharedContent token={token} locale={locale} />
      </Suspense>
    </main>
  );
}

export default function SharedPage({ params }: PageProps<"/[locale]/s/[token]">) {
  return (
    <Suspense fallback={<p className="p-4 text-zinc-400">…</p>}>
      <SharedPageContent params={params} />
    </Suspense>
  );
}
