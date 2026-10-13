import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SongCover } from "@/features/wizard/Cover";
import { format } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth/dal";
import { getDb } from "@/server/db";

const PAGE_SIZE = 12;
const MAX_PAGE = 10000;

type Search = { q?: string; fav?: string; page?: string };

async function LibraryContent({ locale, dict, search }: { locale: Locale; dict: Dictionary; search: Search }) {
  const user = await requireUser();
  const term = (search.q ?? "").trim().slice(0, 80);
  const favoritesOnly = search.fav === "1";
  const page = Math.max(1, Math.min(MAX_PAGE, Number.parseInt(search.page ?? "1", 10) || 1));

  const where = {
    userId: user.id,
    ...(favoritesOnly ? { favorite: true } : {}),
    ...(term
      ? {
          OR: [
            { title: { contains: term, mode: "insensitive" as const } },
            { prompt: { contains: term, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const db = getDb();
  const [songs, total] = await Promise.all([
    db.song.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        status: true,
        mood: true,
        energy: true,
        favorite: true,
        createdAt: true,
        audioPurgedAt: true,
      },
    }),
    db.song.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (favoritesOnly) params.set("fav", "1");
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return `/${locale}/library${query ? `?${query}` : ""}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{dict.library.title}</h1>
        <Link href={`/${locale}/create`} className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-600">
          {dict.dashboard.createCta}
        </Link>
      </div>

      <form method="get" action={`/${locale}/library`} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="library-q" className="block text-sm text-zinc-300">
            {dict.library.searchLabel}
          </label>
          <input
            id="library-q"
            name="q"
            type="search"
            defaultValue={term}
            maxLength={80}
            placeholder={dict.library.searchPlaceholder}
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-50 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-zinc-300">
          <input type="checkbox" name="fav" value="1" defaultChecked={favoritesOnly} className="h-4 w-4 accent-violet-500" />
          {dict.library.favoritesOnly}
        </label>
        <button type="submit" className="rounded-full border border-zinc-700 px-5 py-2.5 text-sm hover:bg-zinc-900">
          {dict.library.searchButton}
        </button>
      </form>

      {songs.length === 0 ? (
        <div className="space-y-4 rounded-3xl border border-dashed border-zinc-700 p-8 text-center">
          <p className="text-zinc-400">{dict.library.empty}</p>
          <Link href={`/${locale}/create`} className="inline-block rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-600">
            {dict.library.emptyCta}
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {songs.map((song) => (
            <li key={song.id}>
              <Link
                href={`/${locale}/songs/${song.id}`}
                className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 hover:border-zinc-600"
              >
                <SongCover mood={song.mood} energy={song.energy} label="" size="sm" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium">{song.title}</p>
                  <p className="text-xs text-zinc-400">
                    {format(dict.library.createdOn, { date: dateFormat.format(song.createdAt) })} · {dict.song.status[song.status]}
                    {song.audioPurgedAt ? ` · ${dict.library.purged}` : ""}
                  </p>
                  {song.favorite && <p className="text-xs text-amber-300">★ {dict.library.favorite}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label={dict.library.title} className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="text-violet-300 underline">
              {dict.library.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-zinc-400">{format(dict.library.page, { page })}</span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="text-violet-300 underline">
              {dict.library.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

async function LibraryPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix="/library" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-16">
        <Suspense fallback={<p className="text-zinc-400">{dict.common.loading}</p>}>
          <LibraryContent locale={locale} dict={dict} search={await searchParams} />
        </Suspense>
      </main>
    </>
  );
}

export default function LibraryPage({ params, searchParams }: PageProps<"/[locale]/library">) {
  return (
    <Suspense fallback={<p className="p-4 text-zinc-400">…</p>}>
      <LibraryPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
