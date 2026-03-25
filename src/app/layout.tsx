import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lia Giorgi — Traditional Tattoo Artist",
  description:
    "Book your tattoo session with Lia Giorgi. Traditional & Old School tattoo art in Malmö and Copenhagen.",
  openGraph: {
    title: "Lia Giorgi — Traditional Tattoo Artist",
    description:
      "Traditional & Old School tattoo art. Book your session in Malmö or Copenhagen.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
