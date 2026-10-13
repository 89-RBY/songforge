import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/features/admin/AdminNav";
import { SiteHeader } from "@/components/SiteHeader";
import { format, getDictionary } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { isLocale, type Locale } from "@/i18n/routing";
import { requireAdmin } from "@/server/auth/dal";
import { getAdminMetrics } from "@/server/admin/metrics";
import { getDb } from "@/server/db";
import { getPricing } from "@/server/pricing/settings";

async function OverviewContent({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  await requireAdmin();
  const db = getDb();
  const [metrics, pricing] = await Promise.all([getAdminMetrics(db), getPricing(db)]);
  const t = dict.admin.overview;
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const count = new Intl.NumberFormat(locale);
  const euros = (cents: number) => money.format(cents / 100);

  const cards = [
    { label: t.songs, value: count.format(metrics.songs30) },
    { label: t.ready, value: count.format(metrics.ready30) },
    { label: t.failed, value: count.format(metrics.failed30) },
    { label: t.activeUsers, value: count.format(metrics.activeUsers30) },
    { label: t.totalUsers, value: count.format(metrics.totalUsers) },
    { label: t.blockedUsers, value: count.format(metrics.blockedUsers) },
    { label: t.revenue, value: euros(metrics.revenueCents30) },
    { label: t.apiCost, value: euros(metrics.apiCostCents30) },
    { label: t.margin, value: euros(metrics.revenueCents30 - metrics.apiCostCents30) },
    { label: t.creditsSold, value: count.format(metrics.creditsSold30) },
    { label: t.creditsSpent, value: count.format(metrics.creditsSpent30) },
    { label: t.dailySpend, value: euros(metrics.apiSpendTodayCents), hint: format(t.dailyCap, { amount: euros(pricing.dailyApiCapCents) }) },
  ];

  return (
    <>
      <p className="text-sm text-zinc-400">{t.subtitle}</p>
      <dl className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-zinc-800 p-4">
            <dt className="text-sm text-zinc-400">{card.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {card.value}
              {card.hint && <span className="mt-1 block text-xs font-normal text-zinc-400">{card.hint}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-zinc-400">{t.note}</p>

      <section className="space-y-2">
        <h2 className="font-semibold">{t.errorsTitle}</h2>
        {metrics.errors7.length === 0 ? (
          <p className="text-zinc-400">{t.noErrors}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {metrics.errors7.map((item) => (
              <li key={item.code} className="flex justify-between rounded-lg border border-zinc-800 px-3 py-2">
                <span className="font-mono">{item.code}</span>
                <span className="tabular-nums">{count.format(item.count)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default async function AdminOverviewPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix="/admin" />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pb-16">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{dict.admin.title}</h1>
        <AdminNav locale={locale} dict={dict} current="overview" />
        <Suspense fallback={<p className="text-zinc-400">{dict.common.loading}</p>}>
          <OverviewContent locale={locale} dict={dict} />
        </Suspense>
      </main>
    </>
  );
}
