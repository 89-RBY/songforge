import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
import type { Dictionary } from "@/i18n/dictionaries/it";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/routing";
import { getEnv } from "@/server/config/env";

const emailSchema = z.email();

// Auth.js answers with its own routes. Send the browser to our pages, keeping only the path so it cannot leave the app.
function pathForAuthResponse(locale: Locale, authUrl: string | undefined): string {
  if (!authUrl) return `/${locale}/login?error=signin`;
  const url = new URL(authUrl, getEnv().APP_URL);
  if (url.pathname === "/api/auth/verify-request") return `/${locale}/login/check-email`;
  if (url.pathname === "/login") return `/${locale}/login${url.search}`;
  return `${url.pathname}${url.search}`;
}

async function requestMagicLink(locale: Locale, formData: FormData) {
  "use server";
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) {
    redirect(`/${locale}/login?error=invalid-email`);
  }
  const authUrl = await signIn("nodemailer", {
    email: parsed.data,
    redirectTo: `/${locale}/dashboard`,
    redirect: false,
  });
  redirect(pathForAuthResponse(locale, authUrl));
}

async function signInWithGoogle(locale: Locale) {
  "use server";
  await signIn("google", { redirectTo: `/${locale}/dashboard` });
}

async function LoginContent({
  locale,
  dict,
  searchParams,
}: {
  locale: Locale;
  dict: Dictionary;
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const googleEnabled = Boolean(getEnv().GOOGLE_CLIENT_ID);
  const errorMessage = error ? ((dict.login.errors as Record<string, string>)[error] ?? dict.login.errors.fallback) : null;

  return (
    <>
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{dict.login.title}</h1>
        <p className="text-zinc-400">{dict.login.subtitle}</p>
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </p>
      )}

      <form action={requestMagicLink.bind(null, locale)} className="space-y-3">
        <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
          {dict.login.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={dict.login.emailPlaceholder}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none"
        />
        <button type="submit" className="w-full rounded-lg bg-violet-500 px-4 py-3 font-medium text-white hover:bg-violet-400">
          {dict.login.submit}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-500">
            <span className="h-px flex-1 bg-zinc-800" />
            {dict.login.or}
            <span className="h-px flex-1 bg-zinc-800" />
          </div>
          <form action={signInWithGoogle.bind(null, locale)}>
            <button type="submit" className="w-full rounded-lg border border-zinc-700 px-4 py-3 font-medium hover:bg-zinc-900">
              {dict.login.google}
            </button>
          </form>
        </>
      )}
    </>
  );
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix="/login" />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 pb-16">
        <Suspense fallback={<p className="text-zinc-400">{dict.common.loading}</p>}>
          <LoginContent locale={locale} dict={dict} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
