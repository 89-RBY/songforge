import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { DeleteAccount } from "@/features/account/DeleteAccount";
import { format, getDictionary } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { isLocale, type Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth/dal";

async function AccountContent({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const user = await requireUser();
  const t = dict.account;

  return (
    <>
      <section className="space-y-2">
        <dl className="grid gap-3 rounded-2xl border border-zinc-800 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-400">{t.email}</dt>
            <dd className="break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">{t.balance}</dt>
            <dd>{format(dict.billing.balanceValue, { count: user.creditBalance })}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.exportTitle}</h2>
        <p className="text-zinc-400">{t.exportText}</p>
        <a href="/api/account/export" download className="w-fit rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-900">
          {t.exportCta}
        </a>
      </section>

      <section className="space-y-3 rounded-2xl border border-red-500/30 p-4">
        <h2 className="text-lg font-semibold">{t.deleteTitle}</h2>
        <p className="text-zinc-400">{t.deleteText}</p>
        <DeleteAccount email={user.email} locale={locale} texts={t} />
      </section>
    </>
  );
}

export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix="/account" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pb-16">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{dict.account.title}</h1>
        <Suspense fallback={<p className="text-zinc-400">{dict.common.loading}</p>}>
          <AccountContent locale={locale} dict={dict} />
        </Suspense>
      </main>
    </>
  );
}
