import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  TradDivider,
  LineDivider,
  CornerOrnament,
} from "@/components/decorative/TradDivider";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations("hero");
  const tHome = useTranslations("home");
  const tAbout = useTranslations("about");
  const tBooking = useTranslations("booking");
  const tNav = useTranslations("nav");

  return (
    <div className="flex flex-col">
      {/* ═══════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════ */}
      <section className="relative flex flex-col items-center justify-center min-h-[90vh] px-4 text-center overflow-hidden">
        {/* Decorative corner ornaments */}
        <CornerOrnament position="top-left" />
        <CornerOrnament position="top-right" />
        <CornerOrnament position="bottom-left" />
        <CornerOrnament position="bottom-right" />

        {/* Inner frame — traditional tattoo border */}
        <div className="absolute inset-6 sm:inset-12 border border-ink-900/8 pointer-events-none" />
        <div className="absolute inset-8 sm:inset-14 border border-ink-900/5 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-8 max-w-2xl">
          {/* Top ornamental mark */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-px bg-ink-900/20" />
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              className="text-accent/60"
            >
              <path
                d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5L6 0Z"
                fill="currentColor"
              />
            </svg>
            <div className="w-12 h-px bg-ink-900/20" />
          </div>

          {/* Name — Rye is wide, so scale down from Playfair sizes */}
          <h1 className="font-display text-[1.55rem] min-[375px]:text-[2rem] sm:text-5xl lg:text-6xl font-normal text-ink-900 leading-[1]">
            {t("title")}
          </h1>

          {/* Subtitle */}
          <p className="text-[0.8rem] sm:text-lg text-foreground-muted uppercase tracking-[0.12em] min-[375px]:tracking-[0.2em] sm:tracking-[0.35em] font-medium">
            {t("subtitle")}
          </p>

          {/* Decorative star divider */}
          <TradDivider className="w-48" />

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-5 mt-2">
            <Link
              href="/booking"
              className="btn-primary px-10 py-3.5 text-sm tracking-wider inline-block"
            >
              {t("cta")}
            </Link>
            <Link
              href="/portfolio"
              className="group flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-ink-900/60 hover:text-accent transition-colors"
            >
              {t("viewWork")}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="transition-transform group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Bottom scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-ink-900/20">
          <div className="w-px h-8 bg-ink-900/15" />
          <svg width="12" height="8" viewBox="0 0 12 8" fill="currentColor">
            <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FLASH PREVIEW STRIP
          ═══════════════════════════════════════ */}
      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.4em] text-foreground-muted mb-3">
              {tNav("portfolio")}
            </p>
            <LineDivider className="max-w-xs mx-auto" />
          </div>

          {/* Flash grid — placeholder cards styled as polaroid-esque frames */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              "Eagle",
              "Rose",
              "Panther",
              "Snake",
              "Anchor",
              "Swallow",
              "Dagger",
              "Heart",
            ].map((name) => (
              <div
                key={name}
                className="group relative aspect-square bg-sabbia-100 border border-ink-900/8 overflow-hidden transition-all hover:border-ink-900/15 hover:shadow-md"
              >
                {/* Placeholder pattern */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-ink-900/15">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                    >
                      <path d="M12 2L14.5 8.5L21 12L14.5 15.5L12 22L9.5 15.5L3 12L9.5 8.5L12 2Z" />
                    </svg>
                    <span className="text-xs font-medium uppercase tracking-widest">
                      {name}
                    </span>
                  </div>
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-ink-900/0 group-hover:bg-ink-900/5 transition-colors" />
              </div>
            ))}
          </div>

          {/* View all link */}
          <div className="text-center mt-10">
            <Link
              href="/portfolio"
              className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-accent hover:text-accent-hover transition-colors border-b border-accent/30 hover:border-accent pb-1"
            >
              {t("viewWork")}
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          ABOUT TEASER
          ═══════════════════════════════════════ */}
      <section className="relative py-14 sm:py-24 px-4 bg-sabbia-100/40">
        <LineDivider className="absolute top-0 left-0 right-0" />

        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-foreground-muted mb-6">
            {tAbout("title")}
          </p>

          <blockquote className="font-display text-2xl sm:text-3xl lg:text-4xl font-normal text-ink-900 leading-snug mb-8">
            &ldquo;{tHome("quote")}
            <br />
            <span className="text-accent">{tHome("quoteHighlight")}</span>&rdquo;
          </blockquote>

          <p className="text-base text-foreground-muted max-w-xl mx-auto leading-relaxed mb-8">
            {tAbout("bio")}
          </p>

          <TradDivider className="w-32 mx-auto mb-8" />

          <Link
            href="/about"
            className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-ink-900/60 hover:text-accent transition-colors"
          >
            {tAbout("title")}
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
        </div>

        <LineDivider className="absolute bottom-0 left-0 right-0" />
      </section>

      {/* ═══════════════════════════════════════
          BOOKING CTA — bottom of page
          ═══════════════════════════════════════ */}
      <section className="relative py-16 sm:py-28 px-4 text-center bg-ink-900 text-sabbia-50 overflow-hidden">
        {/* Subtle texture inversion */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />

        <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center gap-6">
          <TradDivider className="w-32 [&_svg]:text-sabbia-50/40 [&_div]:from-transparent [&_div]:to-sabbia-50/20" />

          <h2 className="font-display text-3xl sm:text-5xl font-normal text-sabbia-50">
            {tBooking("title")}
          </h2>

          <p className="text-sabbia-200 text-base leading-relaxed">
            {tBooking("subtitle")}
          </p>

          <Link
            href="/booking"
            className="mt-2 inline-block px-10 py-3.5 text-sm font-semibold uppercase tracking-wider bg-accent text-sabbia-50 hover:bg-accent-hover active:bg-accent-active transition-colors"
          >
            {t("cta")}
          </Link>
        </div>
      </section>
    </div>
  );
}
