import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/routing";

// pathSuffix is the current page without the locale, e.g. "/create", so switching language keeps the page.
export function SiteHeader({ locale, dict, pathSuffix }: { locale: Locale; dict: Dictionary; pathSuffix: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
      <Link href={`/${locale}`} className="text-lg font-semibold tracking-tight">
        {dict.meta.title}
      </Link>
      <nav aria-label={dict.common.language} className="flex gap-1 text-xs">
        {LOCALES.map((code) => (
          <Link
            key={code}
            href={`/${code}${pathSuffix}`}
            hrefLang={code}
            aria-current={code === locale ? "page" : undefined}
            className={`rounded-full px-2.5 py-1 ${
              code === locale ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {LOCALE_NAMES[code]}
          </Link>
        ))}
      </nav>
    </header>
  );
}
