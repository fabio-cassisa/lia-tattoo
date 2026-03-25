import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "sv", "it", "da"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];
