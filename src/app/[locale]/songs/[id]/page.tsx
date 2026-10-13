import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/routing";
import { SongView } from "@/features/songs/SongView";
import { requireUser } from "@/server/auth/dal";
import { getDb } from "@/server/db";
import { getSongForUser } from "@/server/songs/service";

async function SongContent({ id, locale, dict }: { id: string; locale: Locale; dict: Dictionary }) {
  const user = await requireUser();
  const song = await getSongForUser(getDb(), user.id, id);
  if (!song) return <p className="text-zinc-400">{dict.song.notFound}</p>;

  return (
    <SongView
      dict={dict}
      createHref={`/${locale}/create`}
      initial={{
        id: song.id,
        title: song.title,
        status: song.status,
        lyrics: song.generatedLyrics ?? song.lyrics ?? null,
        audioUrl: song.status === "READY" ? `/api/songs/${song.id}/audio` : null,
        errorMessage: song.errorMessage,
        durationMode: song.durationMode,
        instrumental: song.instrumental,
      }}
    />
  );
}

// Song ids are not known at build time, so params are read inside the Suspense boundary (runtime data).
async function SongPageContent({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix={`/songs/${id}`} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-12">
        <Suspense fallback={<p className="text-zinc-400">…</p>}>
          <SongContent id={id} locale={locale} dict={dict} />
        </Suspense>
      </main>
    </>
  );
}

export default function SongPage({ params }: PageProps<"/[locale]/songs/[id]">) {
  return (
    <Suspense fallback={<p className="p-4 text-zinc-400">…</p>}>
      <SongPageContent params={params} />
    </Suspense>
  );
}
