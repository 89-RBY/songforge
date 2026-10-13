import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries/it";
import type { Locale } from "@/i18n/routing";

export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <footer className="border-t border-zinc-800 px-4 py-6 text-sm text-zinc-400">
      <nav aria-label={dict.footer.label} className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-2">
        <Link href={`/${locale}/terms`} className="hover:text-zinc-200">
          {dict.legal.terms}
        </Link>
        <Link href={`/${locale}/privacy`} className="hover:text-zinc-200">
          {dict.legal.privacy}
        </Link>
        <Link href={`/${locale}/account`} className="hover:text-zinc-200">
          {dict.footer.account}
        </Link>
      </nav>
    </footer>
  );
}
