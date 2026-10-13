import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/features/admin/AdminNav";
import { UserActions } from "@/features/admin/UserActions";
import { SiteHeader } from "@/components/SiteHeader";
import { format, getDictionary } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { isLocale, type Locale } from "@/i18n/routing";
import { requireAdmin } from "@/server/auth/dal";
import { getUserDetail } from "@/server/admin/users";
import { getDb } from "@/server/db";

async function UserContent({ locale, dict, id }: { locale: Locale; dict: Dictionary; id: string }) {
  const admin = await requireAdmin();
  const detail = await getUserDetail(getDb(), id);
  if (!detail) notFound();
  const { user, songCount, ledger } = detail;
  const t = dict.admin.detail;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <Link href={`/${locale}/admin/users`} className="w-fit text-sm text-violet-300 underline">
        {t.back}
      </Link>
      <dl className="grid gap-3 rounded-2xl border border-zinc-800 p-4 text-sm sm:grid-cols-2">
        <Row label={dict.admin.users.columns.email} value={user.email} />
        <Row label={t.name} value={user.name ?? "—"} />
        <Row label={t.role} value={dict.admin.users.roles[user.role]} />
        <Row label={dict.admin.users.columns.status} value={user.blocked ? dict.admin.users.blocked : dict.admin.users.active} />
        <Row label={t.balance} value={format(dict.billing.balanceValue, { count: user.creditBalance })} />
        <Row label={t.songs} value={String(songCount)} />
        <Row label={t.registered} value={date.format(user.createdAt)} />
      </dl>

      <UserActions userId={user.id} blocked={user.blocked} isSelf={admin.id === user.id} texts={t} errors={dict.admin.errors} />

      <section className="space-y-2">
        <h2 className="font-semibold">{t.ledgerTitle}</h2>
        {ledger.length === 0 ? (
          <p className="text-zinc-400">{t.ledgerEmpty}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {ledger.map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2">
                <span className="text-zinc-300">
                  {date.format(entry.createdAt)} · {dict.billing.reasons[entry.reason]}
                </span>
                <span className="tabular-nums">
                  {entry.amount > 0 ? `+${entry.amount}` : entry.amount} → {entry.balanceAfter}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-400">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  );
}

export default function AdminUserPage({ params }: { params: PageProps<"/[locale]/admin/users/[id]">["params"] }) {
  // The id is a runtime value: it is read inside Suspense so the build can prerender the shell.
  return (
    <Suspense fallback={null}>
      <AdminUserShell params={params} />
    </Suspense>
  );
}

async function AdminUserShell({ params }: { params: PageProps<"/[locale]/admin/users/[id]">["params"] }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix="/admin/users" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-16">
        <AdminNav locale={locale} dict={dict} current="users" />
        <Suspense fallback={<p className="text-zinc-400">{dict.common.loading}</p>}>
          <UserContent locale={locale} dict={dict} id={id} />
        </Suspense>
      </main>
    </>
  );
}
