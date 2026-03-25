"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";

export default function Header() {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/portfolio", label: t("portfolio") },
    { href: "/booking", label: t("booking") },
    { href: "/about", label: t("about") },
    { href: "/aftercare", label: t("aftercare") },
  ] as const;

  const localeLabels: Record<Locale, string> = {
    en: "EN",
    sv: "SV",
    it: "IT",
    da: "DA",
  };

  function switchLocale(newLocale: Locale) {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <header className="sticky top-0 z-50 bg-sabbia-50/95 backdrop-blur-sm border-b border-ink-900/10">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-ink-900">
              liagiorgi.one.ttt
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium uppercase tracking-widest transition-colors hover:text-accent ${
                  pathname === item.href
                    ? "text-accent"
                    : "text-ink-900/70"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Locale switcher */}
            <div className="flex items-center gap-1 ml-4 border-l border-ink-900/10 pl-4">
              {routing.locales.map((loc) => (
                <button
                  key={loc}
                  onClick={() => switchLocale(loc)}
                  className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                    locale === loc
                      ? "bg-ink-900 text-sabbia-50"
                      : "text-ink-900/50 hover:text-ink-900"
                  }`}
                >
                  {localeLabels[loc]}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden relative z-10 p-2 -mr-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <div className="w-6 flex flex-col gap-1.5">
              <span
                className={`block h-0.5 bg-ink-900 transition-transform ${
                  mobileOpen ? "rotate-45 translate-y-2" : ""
                }`}
              />
              <span
                className={`block h-0.5 bg-ink-900 transition-opacity ${
                  mobileOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`block h-0.5 bg-ink-900 transition-transform ${
                  mobileOpen ? "-rotate-45 -translate-y-2" : ""
                }`}
              />
            </div>
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-ink-900/10 relative z-50 bg-sabbia-50">
            <div className="flex flex-col gap-2 pt-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`text-sm font-medium uppercase tracking-widest py-3 transition-colors ${
                    pathname === item.href
                      ? "text-accent"
                      : "text-ink-900/70"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex items-center gap-2 pt-3 border-t border-ink-900/10 mt-2">
                {routing.locales.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => {
                      switchLocale(loc);
                      setMobileOpen(false);
                    }}
                    className={`text-xs font-medium px-3 py-2 min-h-[44px] min-w-[44px] rounded transition-colors ${
                      locale === loc
                        ? "bg-ink-900 text-sabbia-50"
                        : "text-ink-900/50 hover:text-ink-900"
                    }`}
                  >
                    {localeLabels[loc]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
