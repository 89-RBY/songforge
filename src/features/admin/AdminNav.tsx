import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries/it";
import type { Locale } from "@/i18n/routing";

type Section = "overview" | "users" | "settings" | "errors";

const PATHS: Record<Section, string> = { overview: "", users: "/users", settings: "/settings", errors: "/errors" };

export function AdminNav({ locale, dict, current }: { locale: Locale; dict: Dictionary; current: Section }) {
  return (
    <nav aria-label={dict.admin.title} className="flex flex-wrap gap-2 text-sm">
      {(Object.keys(PATHS) as Section[]).map((section) => (
        <Link
          key={section}
          href={`/${locale}/admin${PATHS[section]}`}
          aria-current={section === current ? "page" : undefined}
          className={`rounded-full px-4 py-1.5 ${
            section === current ? "bg-violet-600 text-white" : "border border-zinc-700 text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          {dict.admin.nav[section]}
        </Link>
      ))}
    </nav>
  );
}
