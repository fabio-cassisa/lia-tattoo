import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import {
  TradDivider,
  LineDivider,
} from "@/components/decorative/TradDivider";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AftercarePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AftercareContent />;
}

function AftercareContent() {
  const t = useTranslations("aftercare");

  const steps = [
    { title: t("step1Title"), text: t("step1Text"), number: "01" },
    { title: t("step2Title"), text: t("step2Text"), number: "02" },
    { title: t("step3Title"), text: t("step3Text"), number: "03" },
    { title: t("step4Title"), text: t("step4Text"), number: "04" },
    { title: t("step5Title"), text: t("step5Text"), number: "05" },
  ];

  const dos = [t("do1"), t("do2"), t("do3"), t("do4")];
  const donts = [t("dont1"), t("dont2"), t("dont3"), t("dont4")];

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <section className="pt-10 sm:pt-16 pb-8 sm:pb-12 px-4 text-center">
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

      {/* Intro */}
      <section className="px-4 pb-8">
        <p className="max-w-2xl mx-auto text-center text-sm text-foreground-muted leading-relaxed">
          {t("intro")}
        </p>
      </section>

      {/* Steps */}
      <section className="py-12 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-0">
          {steps.map((step, i) => (
            <div key={i} className="relative flex gap-6 pb-10 last:pb-0">
              {/* Vertical line */}
              {i < steps.length - 1 && (
                <div className="absolute left-5 top-10 bottom-0 w-px bg-ink-900/8" />
              )}

              {/* Number circle */}
              <div className="relative z-10 flex-shrink-0 w-10 h-10 bg-sabbia-50 border border-ink-900/10 flex items-center justify-center">
                <span className="text-xs font-bold text-accent tracking-wider">
                  {step.number}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 pt-1">
                <h3 className="font-display text-lg font-bold text-ink-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-foreground-muted leading-relaxed">
                  {step.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Do's and Don'ts */}
      <section className="py-10 sm:py-16 px-4 bg-sabbia-100/40">
        <LineDivider className="max-w-xs mx-auto mb-12" />
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          {/* Do's */}
          <div className="p-6 sm:p-8 border border-ink-900/8 bg-sabbia-50">
            <h2 className="font-display text-xl font-bold text-ink-900 mb-4 flex items-center gap-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="text-green-700"
              >
                <path
                  d="M4 10l4 4 8-8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t("doTitle")}
            </h2>
            <ul className="flex flex-col gap-3">
              {dos.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-foreground-muted"
                >
                  <span className="w-1.5 h-1.5 bg-green-700/40 rounded-full mt-1.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Don'ts */}
          <div className="p-6 sm:p-8 border border-ink-900/8 bg-sabbia-50">
            <h2 className="font-display text-xl font-bold text-ink-900 mb-4 flex items-center gap-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="text-accent"
              >
                <path
                  d="M6 6l8 8M14 6l-8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t("dontTitle")}
            </h2>
            <ul className="flex flex-col gap-3">
              {donts.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-foreground-muted"
                >
                  <span className="w-1.5 h-1.5 bg-accent/40 rounded-full mt-1.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Contact note */}
      <section className="py-10 sm:py-16 px-4 text-center">
        <TradDivider className="w-32 mx-auto mb-8" />
        <p className="text-sm text-foreground-muted max-w-md mx-auto italic">
          {t("contactNote")}
        </p>
        <a
          href="https://www.instagram.com/liagiorgi.one.ttt/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
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
      </section>
    </div>
  );
}
