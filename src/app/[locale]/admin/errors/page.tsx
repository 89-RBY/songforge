import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/features/admin/AdminNav";
import { SiteHeader } from "@/components/SiteHeader";
import { getDictionary } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { isLocale, type Locale } from "@/i18n/routing";
import { requireAdmin } from "@/server/auth/dal";
import { listRecentFailures } from "@/server/admin/users";
import { getDb } from "@/server/db";

// Shows the error code and the message shown to the user. The prompt and the lyrics are never displayed here.
async function FailuresContent({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  await requireAdmin();
  const failures = await listRecentFailures(getDb());
  const t = dict.admin.errorsPage;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });

  if (failures.length === 0) return <p className="text-zinc-400">{t.empty}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="text-zinc-400">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">{t.columns.date}</th>
            <th scope="col" className="px-4 py-2 font-medium">{t.columns.user}</th>
            <th scope="col" className="px-4 py-2 font-medium">{t.columns.provider}</th>
            <th scope="col" className="px-4 py-2 font-medium">{t.columns.code}</th>
            <th scope="col" className="px-4 py-2 font-medium">{t.columns.message}</th>
          </tr>
        </thead>
        <tbody>
          {failures.map((failure) => (
            <tr key={failure.id} className="border-t border-zinc-800 align-top">
              <td className="whitespace-nowrap px-4 py-2 text-zinc-300">{date.format(failure.updatedAt)}</td>
              <td className="px-4 py-2">
                <Link href={`/${locale}/admin/users/${failure.userId}`} className="break-all text-violet-300 underline">
                  {failure.user.email}
                </Link>
              </td>
              <td className="px-4 py-2 text-zinc-300">
                {failure.providerId} · {failure.durationMode}
              </td>
              <td className="px-4 py-2 font-mono text-xs">{failure.errorCode ?? "—"}</td>
              <td className="px-4 py-2 text-zinc-300">{failure.errorMessage ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminErrorsPage({ params }: PageProps<"/[locale]/admin/errors">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix="/admin/errors" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-16">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{dict.admin.errorsPage.title}</h1>
        <AdminNav locale={locale} dict={dict} current="errors" />
        <p className="text-sm text-zinc-400">{dict.admin.errorsPage.intro}</p>
        <Suspense fallback={<p className="text-zinc-400">{dict.common.loading}</p>}>
          <FailuresContent locale={locale} dict={dict} />
        </Suspense>
      </main>
    </>
  );
}
