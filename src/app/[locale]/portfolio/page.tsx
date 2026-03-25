import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import {
  TradDivider,
  LineDivider,
} from "@/components/decorative/TradDivider";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PortfolioPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PortfolioContent />;
}

function PortfolioContent() {
  const t = useTranslations("portfolio");

  const flashDesigns = [
    "Eagle",
    "Rose",
    "Panther",
    "Snake",
    "Anchor",
    "Swallow",
    "Dagger",
    "Heart",
    "Ship",
    "Skull",
    "Tiger",
    "Wolf",
  ];

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <section className="pt-16 pb-12 px-4 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-foreground-muted mb-4">
          liagiorgi.one.ttt
        </p>
        <h1 className="font-display text-4xl sm:text-6xl font-bold text-ink-900 mb-4">
          {t("title")}
        </h1>
        <p className="text-base text-foreground-muted max-w-lg mx-auto">
          {t("subtitle")}
        </p>
        <TradDivider className="w-32 mx-auto mt-8" />
      </section>

      {/* Flash Designs Section */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-900 mb-2">
              {t("flashTitle")}
            </h2>
            <p className="text-sm text-foreground-muted">
              {t("flashDescription")}
            </p>
            <LineDivider className="max-w-xs mx-auto mt-6" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {flashDesigns.map((name) => (
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
        </div>
      </section>

      {/* Completed Work Section */}
      <section className="py-16 px-4 bg-sabbia-100/40">
        <LineDivider className="max-w-xs mx-auto mb-12" />
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-900 mb-2">
              {t("completedTitle")}
            </h2>
            <p className="text-sm text-foreground-muted">
              {t("completedDescription")}
            </p>
          </div>

          {/* Coming soon state */}
          <div className="text-center py-16">
            <div className="inline-flex flex-col items-center gap-4 p-8 border border-ink-900/8 bg-sabbia-50">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-ink-900/20"
              >
                <path d="M12 2L14.5 8.5L21 12L14.5 15.5L12 22L9.5 15.5L3 12L9.5 8.5L12 2Z" />
              </svg>
              <p className="text-sm text-foreground-muted max-w-sm">
                {t("comingSoon")}
              </p>
              <a
                href="https://www.instagram.com/liagiorgi.one.ttt/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
              >
                {t("instagram")}
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
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
