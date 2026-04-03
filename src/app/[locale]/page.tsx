import { useTranslations } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import {
  TradDivider,
  LineDivider,
  CornerOrnament,
} from "@/components/decorative/TradDivider";
import { TattooArtwork } from "@/components/decorative/TattooArtwork";
import { getAlternates, getWebSiteJsonLd, getLocalBusinessJsonLd } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/server";

export const revalidate = 60; // ISR — revalidate every 60 seconds

type FlashPreviewImage = {
  id: string;
  url: string;
  title: string | null;
};

async function getHomepagePreviewImages(): Promise<FlashPreviewImage[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("portfolio_images")
      .select("id, title, storage_path")
      .eq("is_visible", true)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      console.error("Homepage preview fetch error:", error);
      return [];
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    return (data ?? []).map((img) => ({
      id: img.id,
      title: img.title,
      url: `${supabaseUrl}/storage/v1/object/public/portfolio/${img.storage_path}`,
    }));
  } catch (err) {
    console.error("Homepage preview fetch failed:", err);
    return [];
  }
}

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("homeTitle"),
    description: t("homeDescription"),
    alternates: getAlternates(locale, ""),
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const flashImages = await getHomepagePreviewImages();

  return <HomeContent flashImages={flashImages} />;
}

function HomeContent({ flashImages }: { flashImages: FlashPreviewImage[] }) {
  const t = useTranslations("hero");
  const tHome = useTranslations("home");
  const tAbout = useTranslations("about");
  const tBooking = useTranslations("booking");
  const tNav = useTranslations("nav");

  const websiteJsonLd = getWebSiteJsonLd();
  const businessJsonLd = getLocalBusinessJsonLd();

  return (
    <div className="flex flex-col">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
      />
      {/* ═══════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════ */}
      <section className="relative flex flex-col items-center justify-center min-h-[90vh] px-4 text-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-[2]" aria-hidden="true">
          <TattooArtwork
            src="/art/berries/strawberries-together.png"
            sizes="(max-width: 640px) 52vw, (max-width: 1024px) 32vw, 280px"
            loading="eager"
            introDelay={0.02}
            parallax={6}
            className="-left-[4.5rem] top-10 h-64 w-44 rotate-[-10deg] sm:-left-12 sm:top-14 sm:h-80 sm:w-56 lg:-left-6 lg:top-[4.5rem] lg:h-[24rem] lg:w-72"
            imageClassName="mix-blend-normal object-contain opacity-[0.78] drop-shadow-[0_10px_18px_rgba(80,45,20,0.12)]"
          />
          <TattooArtwork
            src="/art/berries/raspberry-02.png"
            sizes="(max-width: 640px) 28vw, (max-width: 1024px) 18vw, 168px"
            introDelay={0.12}
            parallax={4}
            className="-right-10 top-14 h-44 w-32 rotate-[12deg] sm:right-0 sm:top-[4rem] sm:h-56 sm:w-40 lg:right-10 lg:top-[5rem] lg:h-64 lg:w-44"
            imageClassName="mix-blend-normal object-contain opacity-[0.62]"
          />
          <TattooArtwork
            src="/art/berries/strawberry-02.png"
            sizes="(max-width: 640px) 24vw, (max-width: 1024px) 15vw, 136px"
            introDelay={0.2}
            parallax={3}
            className="right-1 bottom-[7rem] h-32 w-24 rotate-[10deg] sm:right-3 sm:bottom-28 sm:h-40 sm:w-28 lg:right-[4.5rem] lg:bottom-[6rem] lg:h-48 lg:w-32"
            imageClassName="mix-blend-normal object-contain opacity-[0.56]"
          />
          <TattooArtwork
            src="/art/berries/raspberry-01.png"
            sizes="(max-width: 640px) 22vw, (max-width: 1024px) 14vw, 124px"
            introDelay={0.26}
            parallax={3}
            className="-left-4 bottom-28 h-28 w-20 rotate-[18deg] sm:left-3 sm:bottom-28 sm:h-36 sm:w-24 lg:left-[4.5rem] lg:bottom-24 lg:h-44 lg:w-28"
            imageClassName="mix-blend-normal object-contain opacity-[0.52]"
          />
          <TattooArtwork
            src="/art/berries/strawberry-01.png"
            sizes="(max-width: 640px) 20vw, (max-width: 1024px) 14vw, 120px"
            introDelay={0.34}
            parallax={2}
            className="-right-4 bottom-8 h-24 w-[4.5rem] rotate-[-8deg] sm:right-2 sm:bottom-10 sm:h-32 sm:w-24 lg:right-10 lg:bottom-10 lg:h-40 lg:w-28"
            imageClassName="mix-blend-normal object-contain opacity-[0.42]"
          />
        </div>

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
              className="group flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-ink-900/75 hover:text-accent transition-colors"
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
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-ink-900/20" aria-hidden="true">
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

          {/* Homepage preview — latest visible portfolio images or placeholder cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {flashImages.length > 0
              ? flashImages.map((image) => (
                  <Link
                    key={image.id}
                    href="/portfolio"
                    className="group relative aspect-square bg-sabbia-100 border border-ink-900/8 overflow-hidden transition-all hover:border-ink-900/15 hover:shadow-md"
                  >
                    <Image
                      src={image.url}
                      alt={image.title || "Flash tattoo design"}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                    {image.title && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-xs font-medium text-sabbia-50 uppercase tracking-widest">
                          {image.title}
                        </p>
                      </div>
                    )}
                  </Link>
                ))
              : /* Placeholder cards when portfolio is empty */
                [
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
        <div className="pointer-events-none absolute inset-0 z-[2]" aria-hidden="true">
          <TattooArtwork
            src="/art/berries/raspberries-together.png"
            sizes="(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 260px"
            introDelay={0.08}
            parallax={5}
            className="-left-16 bottom-0 h-60 w-[10.5rem] rotate-[-8deg] sm:-left-6 sm:bottom-0 sm:h-[19rem] sm:w-[13.5rem] lg:left-6 lg:bottom-0 lg:h-[22rem] lg:w-[17rem]"
            imageClassName="mix-blend-normal object-contain opacity-[0.74] drop-shadow-[0_10px_18px_rgba(80,45,20,0.1)]"
          />
          <TattooArtwork
            src="/art/berries/strawberry-01.png"
            sizes="(max-width: 640px) 28vw, (max-width: 1024px) 18vw, 168px"
            introDelay={0.16}
            parallax={3}
            className="-right-8 top-8 h-40 w-28 rotate-[14deg] sm:right-5 sm:top-10 sm:h-52 sm:w-36 lg:right-10 lg:top-12 lg:h-60 lg:w-44"
            imageClassName="mix-blend-normal object-contain opacity-[0.64]"
          />
          <TattooArtwork
            src="/art/berries/strawberry-02.png"
            sizes="(max-width: 640px) 22vw, (max-width: 1024px) 14vw, 124px"
            introDelay={0.24}
            parallax={2}
            className="right-8 bottom-10 h-28 w-20 rotate-[-12deg] sm:right-10 sm:bottom-12 sm:h-36 sm:w-24 lg:right-[6.5rem] lg:bottom-14 lg:h-44 lg:w-28"
            imageClassName="mix-blend-normal object-contain opacity-[0.54]"
          />
          <TattooArtwork
            src="/art/berries/raspberry-02.png"
            sizes="(max-width: 640px) 20vw, (max-width: 1024px) 14vw, 120px"
            introDelay={0.3}
            parallax={2}
            className="left-2 top-24 h-24 w-[4.5rem] rotate-[-14deg] sm:left-4 sm:top-28 sm:h-32 sm:w-24 lg:left-[4.5rem] lg:top-[7.5rem] lg:h-40 lg:w-28"
            imageClassName="mix-blend-normal object-contain opacity-[0.44]"
          />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
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
            className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-ink-900/75 hover:text-accent transition-colors"
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
