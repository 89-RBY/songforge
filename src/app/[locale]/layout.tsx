import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { CookieNotice } from "@/features/legal/CookieNotice";
import { SiteFooter } from "@/components/SiteFooter";
import { getDictionary } from "@/i18n";
import { isLocale, LOCALES } from "@/i18n/routing";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.meta.title, description: dict.meta.description };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-zinc-950 font-sans text-zinc-50">
        {children}
        <SiteFooter locale={locale} dict={dict} />
        <CookieNotice
          text={dict.cookies.text}
          ok={dict.cookies.ok}
          moreLabel={dict.cookies.more}
          moreHref={`/${locale}/privacy`}
        />
      </body>
    </html>
  );
}
