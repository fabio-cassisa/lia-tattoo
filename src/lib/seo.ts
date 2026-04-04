import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lia-tattoo.vercel.app").trim();

/**
 * Build canonical URL + hreflang alternates for a given page path and locale.
 * Used by each page's generateMetadata to tell Google about locale variants.
 */
export function getAlternates(locale: string, pagePath: string = ""): Metadata["alternates"] {
  const path = pagePath === "/" ? "" : pagePath;
  const languages: Record<string, string> = {};

  for (const loc of routing.locales) {
    languages[loc] = `${SITE_URL}/${loc}${path}`;
  }
  // x-default points to the default locale
  languages["x-default"] = `${SITE_URL}/${routing.defaultLocale}${path}`;

  return {
    canonical: `${SITE_URL}/${locale}${path}`,
    languages,
  };
}

/**
 * JSON-LD structured data for the website (home page).
 */
export function getWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "liagiorgi.one.ttt",
    alternateName: "Lia Giorgi Tattoo",
    url: SITE_URL,
    description:
      "Traditional & Old School tattoo art based in Malmö, with selected guest-spot dates in Copenhagen.",
    inLanguage: ["en", "sv", "it", "da"],
  };
}

/**
 * JSON-LD structured data for the tattoo business.
 * Uses TattooParlor schema (subtype of LocalBusiness).
 */
export function getLocalBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "TattooParlor",
    name: "liagiorgi.one.ttt",
    description:
      "Traditional & Old School tattoo artist. Flash designs, custom work, consultations, cover-ups.",
    url: SITE_URL,
    image: `${SITE_URL}/opengraph-image`,
    priceRange: "$$",
    // Two locations
    location: [
      {
        "@type": "Place",
        name: "Studio Diamant",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Malmö",
          addressCountry: "SE",
        },
      },
      {
        "@type": "Place",
        name: "Copenhagen / Good Morning Tattoo studio",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Copenhagen",
          addressCountry: "DK",
        },
      },
    ],
    sameAs: ["https://www.instagram.com/liagiorgi.one.ttt/"],
    founder: {
      "@type": "Person",
      name: "Lia Giorgi",
      jobTitle: "Traditional Tattoo Artist",
      sameAs: ["https://www.instagram.com/liagiorgi.one.ttt/"],
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "11:00",
      closes: "18:00",
    },
  };
}
