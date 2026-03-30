import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lia-tattoo.vercel.app").trim();

const locales = ["en", "sv", "it", "da"] as const;
const pages = ["", "/portfolio", "/booking", "/about", "/aftercare"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    for (const locale of locales) {
      // Build hreflang alternates for this page across all locales
      const languages: Record<string, string> = {};
      for (const altLocale of locales) {
        languages[altLocale] = `${SITE_URL}/${altLocale}${page}`;
      }
      languages["x-default"] = `${SITE_URL}/en${page}`;

      entries.push({
        url: `${SITE_URL}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === "/portfolio" ? "weekly" : "monthly",
        priority: page === "" ? 1.0 : page === "/booking" ? 0.9 : 0.7,
        alternates: {
          languages,
        },
      });
    }
  }

  return entries;
}
