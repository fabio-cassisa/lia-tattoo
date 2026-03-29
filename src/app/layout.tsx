import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lia-tattoo.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "liagiorgi.one.ttt — ❋ Traditional Tattoo Artist ❋",
    template: "%s | liagiorgi.one.ttt",
  },
  description:
    "Book your tattoo session with liagiorgi.one.ttt. Traditional & Old School tattoo art in Malmö and Copenhagen.",
  keywords: [
    "tattoo",
    "traditional tattoo",
    "old school tattoo",
    "tattoo booking",
    "Malmö tattoo",
    "Copenhagen tattoo",
    "flash tattoo",
    "liagiorgi.one.ttt",
  ],
  authors: [{ name: "liagiorgi.one.ttt" }],
  creator: "liagiorgi.one.ttt",
  openGraph: {
    title: "liagiorgi.one.ttt — ❋ Traditional Tattoo Artist ❋",
    description:
      "Traditional & Old School tattoo art. Book your session in Malmö or Copenhagen.",
    type: "website",
    siteName: "liagiorgi.one.ttt",
    locale: "en",
    alternateLocale: ["sv", "it", "da"],
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "liagiorgi.one.ttt — ❋ Traditional Tattoo Artist ❋",
    description:
      "Traditional & Old School tattoo art. Book your session in Malmö or Copenhagen.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#faf6ef",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
