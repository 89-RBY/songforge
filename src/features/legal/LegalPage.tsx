import { SiteHeader } from "@/components/SiteHeader";
import { format } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/it";
import type { Locale } from "@/i18n/routing";
import { LEGAL_UPDATED, legalFor, LEGAL, type LegalDocument, type LegalLanguage } from "@/content/legal";

// Renders one legal draft. Outside Italian and English, the English text is shown with a notice.
export function LegalPage({
  locale,
  dict,
  kind,
  pathSuffix,
}: {
  locale: Locale;
  dict: Dictionary;
  kind: "terms" | "privacy";
  pathSuffix: string;
}) {
  const { language, fallback } = legalFor(locale);
  const doc: LegalDocument = LEGAL[language as LegalLanguage][kind];
  const updated = new Date(`${LEGAL_UPDATED}T00:00:00Z`).toLocaleDateString(locale, { dateStyle: "long", timeZone: "UTC" });

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix={pathSuffix} />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 pb-16">
        <div className="space-y-3">
          <p role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {dict.legal.draftNotice}
          </p>
          {fallback && <p className="text-sm text-zinc-300">{dict.legal.fallbackNotice}</p>}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{doc.title}</h1>
          <p className="text-sm text-zinc-400">{format(dict.legal.updated, { date: updated })}</p>
        </div>
        {doc.sections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="text-lg font-semibold">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed text-zinc-300">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
