import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/routing";
import { Wizard } from "@/features/wizard/Wizard";
import type { ProviderOption } from "@/features/wizard/draft";
import { creditsFor } from "@/features/wizard/costs";
import { requireUser } from "@/server/auth/dal";
import { getDb } from "@/server/db";
import { getMusicProviders } from "@/server/music/registry";
import { getPricing } from "@/server/pricing/settings";

async function CreateContent({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const user = await requireUser();
  const pricing = await getPricing(getDb());
  const providers: ProviderOption[] = getMusicProviders()
    .filter((provider) => !pricing.disabledProviders.includes(provider.id))
    .map((provider) => {
      const costs = {
        CLIP: provider.estimateCostCents("CLIP"),
        SONG: provider.estimateCostCents("SONG"),
      };
      return {
        id: provider.id,
        label: provider.label,
        durations: [...provider.capabilities.durations],
        credits: {
          CLIP: creditsFor(costs.CLIP, pricing),
          SONG: creditsFor(costs.SONG, pricing),
        },
      };
    });
  return <Wizard locale={locale} dict={dict} providers={providers} balance={user.creditBalance} />;
}

export default async function CreatePage({ params }: PageProps<"/[locale]/create">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix="/create" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-12">
        <Suspense fallback={<p className="text-zinc-400">{dict.common.loading}</p>}>
          <CreateContent locale={locale} dict={dict} />
        </Suspense>
      </main>
    </>
  );
}
