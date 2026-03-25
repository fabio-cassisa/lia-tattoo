import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

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
  const tLoc = useTranslations("locations");

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center min-h-[85vh] px-4 text-center">
        {/* Decorative border — traditional tattoo style */}
        <div className="absolute inset-4 sm:inset-8 border-2 border-ink-900/10 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-2xl">
          {/* Small decorative element */}
          <div className="w-16 h-0.5 bg-accent" />

          <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-ink-900">
            {t("title")}
          </h1>

          <p className="text-lg sm:text-xl text-foreground-muted uppercase tracking-[0.3em] font-medium">
            {t("subtitle")}
          </p>

          {/* Another decorative line */}
          <div className="w-24 h-0.5 bg-ink-900/20" />

          {/* Locations */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-sm text-foreground-muted">
            <span>{tLoc("malmo")}</span>
            <span className="hidden sm:block text-ink-900/20">&bull;</span>
            <span>{tLoc("copenhagen")}</span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
            <Link
              href="/booking"
              className="btn-primary px-8 py-3 text-sm rounded-none inline-block"
            >
              {t("cta")}
            </Link>
            <Link
              href="/portfolio"
              className="text-sm font-medium uppercase tracking-widest text-ink-900/70 hover:text-accent transition-colors border-b border-ink-900/20 hover:border-accent pb-1"
            >
              {t("viewWork")}
            </Link>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="divider-trad max-w-md mx-auto" />

      {/* Teaser section — will become portfolio preview */}
      <section className="py-24 px-4 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-foreground-muted">
          Traditional &bull; Old School &bull; Tattoo Art
        </p>
      </section>
    </div>
  );
}
