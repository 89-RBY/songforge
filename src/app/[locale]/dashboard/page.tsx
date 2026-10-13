import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth/dal";

async function DashboardContent({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const user = await requireUser();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: `/${locale}` });
  }

  return (
    <>
      <div className="space-y-1">
        <p className="text-sm text-zinc-400">{dict.dashboard.welcome}</p>
        <h1 className="break-all text-2xl font-bold tracking-tight sm:text-3xl">{user.name ?? user.email}</h1>
      </div>
      <Link href={`/${locale}/create`} className="w-fit rounded-full bg-violet-600 px-5 py-2.5 font-medium text-white hover:bg-violet-600">
        {dict.dashboard.createCta}
      </Link>
      <Link href={`/${locale}/library`} className="w-fit rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-900">
        {dict.library.title}
      </Link>
      <p className="text-zinc-400">{dict.dashboard.libraryNote}</p>
      <form action={signOutAction}>
        <button type="submit" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
          {dict.common.signOut}
        </button>
      </form>
    </>
  );
}

export default async function DashboardPage({ params }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix="/dashboard" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-16">
        <Suspense fallback={<p className="text-zinc-400">{dict.common.loading}</p>}>
          <DashboardContent locale={locale} dict={dict} />
        </Suspense>
      </main>
    </>
  );
}
