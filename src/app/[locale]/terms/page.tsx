import { notFound } from "next/navigation";
import { LegalPage } from "@/features/legal/LegalPage";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/routing";

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <LegalPage locale={locale} dict={getDictionary(locale)} kind="terms" pathSuffix="/terms" />;
}
