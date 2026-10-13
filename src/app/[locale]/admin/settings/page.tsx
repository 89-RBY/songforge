import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/features/admin/AdminNav";
import { SettingsForm, type SettingsFormValues } from "@/features/admin/SettingsForm";
import { SiteHeader } from "@/components/SiteHeader";
import { getDictionary } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { isLocale, type Locale } from "@/i18n/routing";
import { requireAdmin } from "@/server/auth/dal";
import { getDb } from "@/server/db";
import { getMusicProviders } from "@/server/music/registry";
import { getPricing } from "@/server/pricing/settings";

const toEuros = (cents: number) => (cents / 100).toFixed(2);

async function SettingsContent({ dict }: { dict: Dictionary }) {
  await requireAdmin();
  const pricing = await getPricing(getDb());
  const initial: SettingsFormValues = {
    marginMultiplier: String(pricing.marginMultiplier),
    centsPerCredit: String(pricing.centsPerCredit),
    signupCredits: String(pricing.signupCredits),
    dailyCapEuros: toEuros(pricing.dailyApiCapCents),
    packages: pricing.packages.map((pkg) => ({ id: pkg.id, credits: String(pkg.credits), priceEuros: toEuros(pkg.priceCents) })),
    disabledProviders: pricing.disabledProviders,
  };
  const providers = getMusicProviders().map((provider) => ({ id: provider.id, label: provider.label }));

  return (
    <SettingsForm
      texts={dict.admin.settings}
      validationText={dict.admin.errors.VALIDATION}
      genericText={dict.admin.errors.GENERIC}
      initial={initial}
      providers={providers}
    />
  );
}

export default async function AdminSettingsPage({ params }: PageProps<"/[locale]/admin/settings">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix="/admin/settings" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-16">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{dict.admin.settings.title}</h1>
        <AdminNav locale={locale as Locale} dict={dict} current="settings" />
        <p className="text-sm text-zinc-400">{dict.admin.settings.intro}</p>
        <Suspense fallback={<p className="text-zinc-400">{dict.common.loading}</p>}>
          <SettingsContent dict={dict} />
        </Suspense>
      </main>
    </>
  );
}
