import { useTranslations } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  TradDivider,
  LineDivider,
  CornerOrnament,
} from "@/components/decorative/TradDivider";
import { getAlternates } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("aboutTitle"),
    description: t("aboutDescription"),
    alternates: getAlternates(locale, "/about"),
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AboutContent />;
}

function AboutContent() {
  const t = useTranslations("about");

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
        <TradDivider className="w-32 mx-auto mt-6" />
      </section>

      {/* Bio section */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative p-8 sm:p-12 border border-ink-900/8 bg-sabbia-50">
            <CornerOrnament position="top-left" />
            <CornerOrnament position="top-right" />
            <CornerOrnament position="bottom-left" />
            <CornerOrnament position="bottom-right" />

            <div className="relative z-10 flex flex-col gap-6">
              {/* Photo placeholder */}
              <div className="w-32 h-32 mx-auto bg-sabbia-100 border border-ink-900/8 flex items-center justify-center">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-ink-900/15"
                >
                  <path d="M12 2L14.5 8.5L21 12L14.5 15.5L12 22L9.5 15.5L3 12L9.5 8.5L12 2Z" />
                </svg>
              </div>

              <p className="text-base text-ink-900 leading-relaxed text-center">
                {t("bio")}
              </p>
              <p className="text-sm text-foreground-muted leading-relaxed text-center">
                {t("studios")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Approach */}
      <section className="py-10 sm:py-16 px-4 bg-sabbia-100/40">
        <LineDivider className="max-w-xs mx-auto mb-8 sm:mb-12" />
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12">
            <div>
              <h2 className="font-display text-2xl font-normal text-ink-900 mb-4">
                {t("approach")}
              </h2>
              <p className="text-sm text-foreground-muted leading-relaxed">
                {t("approachText")}
              </p>
            </div>
            <div>
              <h2 className="font-display text-2xl font-normal text-ink-900 mb-4">
                {t("style")}
              </h2>
              <p className="text-sm text-foreground-muted leading-relaxed">
                {t("styleText")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Studios / Find me */}
      <section className="py-10 sm:py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl font-normal text-ink-900 mb-8">
            {t("findMe")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
            <div className="p-6 border border-ink-900/8 bg-sabbia-50">
              <h3 className="font-display text-xl font-normal text-ink-900 mb-1">
                Studio Diamant
              </h3>
              <p className="text-sm text-foreground-muted">Malmö, Sweden</p>
            </div>
            <div className="p-6 border border-ink-900/8 bg-sabbia-50">
              <h3 className="font-display text-xl font-normal text-ink-900 mb-1">
                Good Morning Tattoo
              </h3>
              <p className="text-sm text-foreground-muted">
                Copenhagen, Denmark
              </p>
            </div>
          </div>

          <p className="text-sm text-foreground-muted italic">
            {t("travelingNote")}
          </p>

          <TradDivider className="w-32 mx-auto mt-8" />

          {/* Instagram link */}
          <a
            href="https://www.instagram.com/liagiorgi.one.ttt/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                clipRule="evenodd"
              />
            </svg>
            @liagiorgi.one.ttt
          </a>
        </div>
      </section>
    </div>
  );
}
