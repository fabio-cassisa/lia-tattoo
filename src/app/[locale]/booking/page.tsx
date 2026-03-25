import { setRequestLocale } from "next-intl/server";
import BookingContent from "./BookingContent";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BookingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <BookingContent />;
}
