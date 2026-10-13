import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/routing";

export default async function CheckEmailPage({ params }: PageProps<"/[locale]/login/check-email">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} dict={dict} pathSuffix="/login" />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 pb-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{dict.checkEmail.title}</h1>
        <p className="text-zinc-400">{dict.checkEmail.body}</p>
        <p className="text-sm text-zinc-400">{dict.checkEmail.spam}</p>
      </main>
    </>
  );
}
