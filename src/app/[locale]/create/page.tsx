import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/routing";
import { Wizard } from "@/features/wizard/Wizard";
import type { ProviderOption } from "@/features/wizard/draft";
import { requireUser } from "@/server/auth/dal";
import { getMusicProviders } from "@/server/music/registry";

async function CreateContent({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  await requireUser();
  const providers: ProviderOption[] = getMusicProviders().map((provider) => ({
    id: provider.id,
    label: provider.label,
    durations: [...provider.capabilities.durations],
    costCents: {
      CLIP: provider.estimateCostCents("CLIP"),
      SONG: provider.estimateCostCents("SONG"),
    },
  }));
  return <Wizard locale={locale} dict={dict} providers={providers} />;
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
