import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "liagiorgi.one.ttt — ❋ Traditional Tattoo Artist ❋",
  description:
    "Book your tattoo session with liagiorgi.one.ttt. Traditional & Old School tattoo art in Malmö and Copenhagen.",
  openGraph: {
    title: "liagiorgi.one.ttt — ❋ Traditional Tattoo Artist ❋",
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
