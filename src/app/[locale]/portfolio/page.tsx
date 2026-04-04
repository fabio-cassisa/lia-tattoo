import { useTranslations } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  TradDivider,
  LineDivider,
} from "@/components/decorative/TradDivider";
import { PortfolioGrid } from "@/components/PortfolioGrid";
import { getSupabaseUrl } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { getAlternates } from "@/lib/seo";

export const revalidate = 60; // ISR — revalidate every 60 seconds

type PortfolioImage = {
  id: string;
  url: string;
  title: string | null;
  category: string;
};

async function getPortfolioImages(): Promise<PortfolioImage[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portfolio_images")
    .select("id, title, category, storage_path")
    .eq("is_visible", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Portfolio fetch error:", error);
    return [];
  }

  const supabaseUrl = getSupabaseUrl();
  return (data ?? []).map((img) => ({
    id: img.id,
    title: img.title,
    category: img.category,
    url: `${supabaseUrl}/storage/v1/object/public/portfolio/${img.storage_path}`,
  }));
}

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("portfolioTitle"),
    description: t("portfolioDescription"),
    alternates: getAlternates(locale, "/portfolio"),
  };
}

export default async function PortfolioPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const images = await getPortfolioImages();
  const flashImages = images.filter((img) => img.category === "flash");
  const completedImages = images.filter((img) => img.category === "completed");

  return (
    <PortfolioContent
      flashImages={flashImages}
      completedImages={completedImages}
    />
  );
}

function EmptyState({ instagram }: { instagram: string }) {
  return (
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
          {instagram}
        </p>
        <a
          href="https://www.instagram.com/liagiorgi.one.ttt/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
        >
          @liagiorgi.one.ttt
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
  );
}

function PortfolioContent({
  flashImages,
  completedImages,
}: {
  flashImages: PortfolioImage[];
  completedImages: PortfolioImage[];
}) {
  const t = useTranslations("portfolio");

  const hasFlash = flashImages.length > 0;
  const hasCompleted = completedImages.length > 0;
  const hasAny = hasFlash || hasCompleted;

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <section className="pt-10 sm:pt-16 pb-8 sm:pb-12 px-4 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-foreground-muted mb-4">
          liagiorgi.one.ttt
        </p>
        <h1 className="font-display text-4xl sm:text-6xl font-normal text-ink-900 mb-4">
          {t("title")}
        </h1>
        <p className="text-base text-foreground-muted max-w-lg mx-auto">
          {t("subtitle")}
        </p>
        <TradDivider className="w-32 mx-auto mt-8" />
      </section>

      {/* Flash Designs Section */}
      <section className="py-10 sm:py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-normal text-ink-900 mb-2">
              {t("flashTitle")}
            </h2>
            <p className="text-sm text-foreground-muted">
              {t("flashDescription")}
            </p>
            <LineDivider className="max-w-xs mx-auto mt-6" />
          </div>

          {hasFlash ? (
            <PortfolioGrid images={flashImages} />
          ) : (
            <EmptyState instagram={t("comingSoon")} />
          )}
        </div>
      </section>

      {/* Completed Work Section */}
      <section className="py-10 sm:py-16 px-4 bg-sabbia-100/40">
        <LineDivider className="max-w-xs mx-auto mb-8 sm:mb-12" />
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-normal text-ink-900 mb-2">
              {t("completedTitle")}
            </h2>
            <p className="text-sm text-foreground-muted">
              {t("completedDescription")}
            </p>
          </div>

          {hasCompleted ? (
            <PortfolioGrid images={completedImages} />
          ) : (
            <EmptyState instagram={t("comingSoon")} />
          )}
        </div>
      </section>

      {/* Instagram CTA — only show if we have some images (otherwise the empty states already link) */}
      {hasAny && (
        <section className="py-10 sm:py-16 px-4 text-center">
          <a
            href="https://www.instagram.com/liagiorgi.one.ttt/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
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
        </section>
      )}
    </div>
  );
}
