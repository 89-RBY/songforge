import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BuyButton } from "@/features/billing/BuyButton";
import { SiteHeader } from "@/components/SiteHeader";
import { format, getDictionary } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { isLocale, type Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth/dal";
import { getStripe } from "@/server/billing/stripe";
import { getDb } from "@/server/db";
import { getPricing } from "@/server/pricing/settings";

const HISTORY_LIMIT = 30;

async function BillingContent({ locale, dict, checkout }: { locale: Locale; dict: Dictionary; checkout?: string }) {
  const user = await requireUser();
  const db = getDb();
  const [pricing, entries] = await Promise.all([
    getPricing(db),
    db.creditEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: { id: true, amount: true, balanceAfter: true, reason: true, createdAt: true },
    }),
  ]);
  const billingEnabled = getStripe() !== null;
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const t = dict.billing;

  return (
    <>
      {checkout === "success" && (
        <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {t.success}
        </p>
      )}
      {checkout === "cancelled" && (
        <p role="status" className="rounded-lg border border-zinc-700 px-4 py-3 text-sm text-zinc-300">
          {t.cancelled}
        </p>
      )}

      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.title}</h1>
        <p className="text-zinc-400">{t.intro}</p>
        <p className="text-sm text-zinc-400">{t.balance}</p>
        <p className="text-3xl font-bold" data-testid="credit-balance">
          {format(t.balanceValue, { count: user.creditBalance })}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.packagesTitle}</h2>
        {!billingEnabled && <p className="text-sm text-amber-200">{t.disabled}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          {pricing.packages.map((pkg) => (
            <div key={pkg.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-800 p-4">
              <p className="font-semibold">{format(t.packageLabel, { count: pkg.credits })}</p>
              <p className="text-zinc-300">{money.format(pkg.priceCents / 100)}</p>
              {billingEnabled && (
                <BuyButton
                  packageId={pkg.id}
                  locale={locale}
                  buy={t.buy}
                  buying={t.buying}
                  genericError={dict.apiErrors.GENERIC}
                  errors={dict.apiErrors}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400">{t.prices}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.historyTitle}</h2>
        {entries.length === 0 ? (
          <p className="text-zinc-400">{t.historyEmpty}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-400">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">{t.columns.date}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t.columns.reason}</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">{t.columns.amount}</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">{t.columns.balance}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-zinc-800">
                    <td className="px-4 py-2 text-zinc-300">{dates.format(entry.createdAt)}</td>
                    <td className="px-4 py-2 text-zinc-300">{t.reasons[entry.reason]}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-300">{entry.balanceAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default async function BillingPage({ params, searchParams }: PageProps<"/[locale]/billing">) {
  return (
    <Suspense fallback={null}>
      <BillingShell params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function BillingShell({ params, searchParams }: PageProps<"/[locale]/billing">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { checkout } = await searchParams;
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix="/billing" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pb-16">
        <Suspense fallback={<p className="text-zinc-400">{dict.common.loading}</p>}>
          <BillingContent locale={locale} dict={dict} checkout={typeof checkout === "string" ? checkout : undefined} />
        </Suspense>
      </main>
    </>
  );
}
