import { setRequestLocale, getTranslations } from "next-intl/server";
import BookingContent from "./BookingContent";
import { getAlternates } from "@/lib/seo";

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

  return <BookingContent />;
}
