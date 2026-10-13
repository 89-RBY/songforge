import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/routing";
import { getCurrentUser } from "@/server/auth/dal";

const PRIMARY = "rounded-full bg-violet-500 px-6 py-3 font-medium text-white hover:bg-violet-400";

async function HomeCta({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const user = await getCurrentUser();
  return (
    <Link href={user ? `/${locale}/create` : `/${locale}/login`} className={PRIMARY}>
      {user ? dict.home.ctaLoggedIn : dict.home.cta}
    </Link>
  );
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix="" />
      <main className="flex flex-1 flex-col items-center gap-8 px-4 py-12 text-center">
        <div className="flex max-w-xl flex-col items-center gap-4">
          <h1 className="text-4xl font-bold tracking-tight">{dict.meta.title}</h1>
          <p className="text-lg text-zinc-200">{dict.home.headline}</p>
          <p className="text-zinc-400">{dict.home.subline}</p>
          <Suspense fallback={<span className="text-zinc-500">{dict.common.loading}</span>}>
            <HomeCta locale={locale} dict={dict} />
          </Suspense>
        </div>
        <section className="w-full max-w-xl space-y-3 text-left">
          <h2 className="text-lg font-semibold">{dict.home.howTitle}</h2>
          <ol className="list-decimal space-y-2 pl-5 text-zinc-300">
            {dict.home.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
        <p className="text-sm text-zinc-500">{dict.home.aiNote}</p>
      </main>
    </>
  );
}
