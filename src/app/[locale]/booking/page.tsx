import { setRequestLocale, getTranslations } from "next-intl/server";
import BookingContent from "./BookingContent";
import type { Locale } from "@/i18n/routing";
import { getAlternates } from "@/lib/seo";
import { getSiteContent, resolveSiteContent } from "@/lib/site-content";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("bookingTitle"),
    description: t("bookingDescription"),
    alternates: getAlternates(locale, "/booking"),
  };
}

export default async function BookingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const content = await getSiteContent(["booking_italy_note"]);

  return (
    <BookingContent
      italyNote={resolveSiteContent(content.booking_italy_note, locale as Locale, "")}
    />
  );
}
