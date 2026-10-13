import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/features/admin/AdminNav";
import { SiteHeader } from "@/components/SiteHeader";
import { getDictionary } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { isLocale, type Locale } from "@/i18n/routing";
import { requireAdmin } from "@/server/auth/dal";
import { listUsers, LIST_LIMIT } from "@/server/admin/users";
import { getDb } from "@/server/db";

async function UsersContent({ locale, dict, query }: { locale: Locale; dict: Dictionary; query?: string }) {
  await requireAdmin();
  const users = await listUsers(getDb(), query);
  const t = dict.admin.users;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <>
      <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <label htmlFor="q" className="block text-sm text-zinc-300">
            {t.search}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query ?? ""}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <button type="submit" className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700">
          {t.searchButton}
        </button>
      </form>

      {users.length === 0 ? (
        <p className="text-zinc-400">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{t.columns.email}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t.columns.role}</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">{t.columns.balance}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t.columns.status}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t.columns.created}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-zinc-800">
                  <td className="px-4 py-2">
                    <Link href={`/${locale}/admin/users/${user.id}`} className="break-all text-violet-300 underline">
                      {user.email}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-300">{t.roles[user.role]}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{user.creditBalance}</td>
                  <td className="px-4 py-2 text-zinc-300">{user.blocked ? t.blocked : t.active}</td>
                  <td className="px-4 py-2 text-zinc-300">{date.format(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {users.length >= LIST_LIMIT && <p className="text-xs text-zinc-400">{t.limitNote}</p>}
    </>
  );
}

export default async function AdminUsersPage({ params, searchParams }: PageProps<"/[locale]/admin/users">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix="/admin/users" />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pb-16">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{dict.admin.users.title}</h1>
        <AdminNav locale={locale} dict={dict} current="users" />
        <Suspense fallback={<p className="text-zinc-400">{dict.common.loading}</p>}>
          <UsersSearch locale={locale} dict={dict} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function UsersSearch({ locale, dict, searchParams }: { locale: Locale; dict: Dictionary; searchParams: PageProps<"/[locale]/admin/users">["searchParams"] }) {
  const { q } = await searchParams;
  return <UsersContent locale={locale} dict={dict} query={typeof q === "string" ? q : undefined} />;
}
