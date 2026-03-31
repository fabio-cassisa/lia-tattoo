"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────

type ConnectionStatus =
  | { connected: false; reason: string }
  | {
      connected: true;
      username: string;
      tokenExpiresAt: string;
      cachedMediaCount: number;
      lastFetchedAt: string | null;
    };

type InsightPriority = "act-now" | "worth-trying" | "good-to-know";

type InsightCard = {
  id: string;
  priority: InsightPriority;
  category: string;
  icon: string;
  titleKey: string;
  bodyKey: string;
  vars: Record<string, string>;
  action?: {
    labelKey: string;
    href?: string;
    type?: "internal" | "external";
  };
  dataPoints?: {
    label: string;
    value: string;
  }[];
};

type InsightsResponse = {
  insights: InsightCard[];
  summary: {
    totalPosts: number;
    totalBookings: number;
    portfolioCount: number;
    avgEngagementRate: string;
    bookingsThisWeek: number;
    bookingsLastWeek: number;
  };
  generatedAt: string;
};

type CoachLocale = "en" | "it" | "sv";

// ── i18n strings (inlined to avoid server import) ───────

const STRINGS: Record<CoachLocale, Record<string, string>> = {
  en: {
    "top-post.title": "This one hit different",
    "top-post.body": "Your {{description}} post reached {{reach}} people \u2014 that\u2019s {{multiplier}}x your average. More content like this could really grow your audience.",
    "top-post.action": "View post",
    "best-content-type.title": "{{winner}}s are your superpower",
    "best-content-type.body": "Your {{winner}} posts get {{multiplier}}x more engagement than {{loser}}s. When in doubt, go with a {{winnerLower}}.",
    "best-content-type.action": "See the data",
    "saves-signal.title": "{{count}} people saved your {{description}}",
    "saves-signal.body": "Saves mean \u201cI want this tattoo.\u201d This design is in demand \u2014 make sure it\u2019s available to book.",
    "saves-signal.action": "Add to portfolio",
    "high-save-ratio.title": "Your save rate is {{rate}}% \u2014 that\u2019s gold",
    "high-save-ratio.body": "The average tattoo artist gets ~2% saves. Your {{description}} post hit {{rate}}%. People are collecting your designs.",
    "best-day.title": "{{day}} is your day",
    "best-day.body": "Posts on {{day}} get {{multiplier}}x more engagement than other days. If you\u2019re dropping new flash, {{day}} is the move.",
    "best-hour.title": "Post around {{time}} for maximum reach",
    "best-hour.body": "Your audience is most active around {{time}}. Posts at that time get {{percent}}% more engagement.",
    "posting-gap.title": "It\u2019s been {{days}} days since your last post",
    "posting-gap.body": "Your last post is losing steam. A quick flash photo or work-in-progress could keep the momentum going.",
    "posting-gap.action": "Open Instagram",
    "consistent-posting.title": "Great rhythm \u2014 keep it up",
    "consistent-posting.body": "You\u2019ve posted {{count}} times in the last {{period}} days. Consistency is what the algorithm rewards.",
    "post-drove-bookings.title": "This post brought in {{count}} bookings",
    "post-drove-bookings.body": "Within {{hours}}h of posting your {{description}}, {{count}} booking requests came in. Content like this converts.",
    "post-drove-bookings.action": "View bookings",
    "content-type-bookings.title": "{{type}} posts drive the most bookings",
    "content-type-bookings.body": "Your {{type}} content leads to {{percent}}% of bookings that come from Instagram. Double down on these.",
    "booking-trend-up.title": "Bookings are up {{percent}}%",
    "booking-trend-up.body": "You got {{thisWeek}} booking requests this week vs {{lastWeek}} last week. Something\u2019s working \u2014 keep posting.",
    "booking-trend-down.title": "Bookings slowed down this week",
    "booking-trend-down.body": "{{thisWeek}} requests this week vs {{lastWeek}} last week. A new post or story could help pick things up.",
    "booking-trend-down.action": "Open Instagram",
    "no-recent-bookings.title": "No bookings this week yet",
    "no-recent-bookings.body": "It might be worth sharing some available flash or a booking reminder in your stories.",
    "portfolio-gap.title": "This popular design isn\u2019t bookable",
    "portfolio-gap.body": "Your {{description}} post got {{saves}} saves but it\u2019s not in your portfolio. People who want it can\u2019t find it on your booking page.",
    "portfolio-gap.action": "Add to portfolio",
    "create-fb-page.title": "Reach more people for free with a Facebook Page",
    "create-fb-page.body": "You can auto-publish your Instagram posts to Facebook. Different audience, zero extra work. Takes 5 minutes to set up.",
    "create-fb-page.action": "Learn how",
    "google-presence.title": "People can\u2019t find you on Google Maps",
    "google-presence.body": "When people search \u201ctattoo artist Malm\u00f6\u201d, you don\u2019t show up. Ask Studio Diamant to add you to their Google Business listing.",
    "comments-engagement.title": "Your followers are talking",
    "comments-engagement.body": "Your {{description}} post got {{comments}} comments \u2014 that\u2019s {{multiplier}}x your average. Replying to comments boosts your visibility in the algorithm.",
    "low-engagement-tip.title": "Try asking a question in your caption",
    "low-engagement-tip.body": "Your recent posts get lots of likes but few comments. Captions that ask \u201cwhich one should I tattoo next?\u201d can double your engagement.",
    "summary-header": "What\u2019s happening",
    "act-now": "Do this now",
    "worth-trying": "Worth trying",
    "good-to-know": "Good to know",
    "no-insights": "Not enough data yet. Once you connect Instagram and have some bookings, insights will appear here.",
    "powered-by": "Based on your last {{count}} posts and {{bookings}} bookings",
    "language-label": "Language",
    "show-details": "Show details",
    "hide-details": "Hide details",
  },
  it: {
    "top-post.title": "Questo ha spaccato",
    "top-post.body": "Il tuo post {{description}} ha raggiunto {{reach}} persone \u2014 {{multiplier}}x la tua media. Pi\u00f9 contenuti cos\u00ec possono far crescere il tuo pubblico.",
    "top-post.action": "Vedi il post",
    "best-content-type.title": "I {{winner}} sono il tuo superpotere",
    "best-content-type.body": "I tuoi post {{winner}} ottengono {{multiplier}}x pi\u00f9 engagement dei {{loser}}. Nel dubbio, vai con un {{winnerLower}}.",
    "best-content-type.action": "Vedi i dati",
    "saves-signal.title": "{{count}} persone hanno salvato il tuo {{description}}",
    "saves-signal.body": "Salvare significa \u201clo voglio\u201d. Questo disegno \u00e8 richiesto \u2014 assicurati che sia prenotabile.",
    "saves-signal.action": "Aggiungi al portfolio",
    "high-save-ratio.title": "Il tuo tasso di salvataggio \u00e8 {{rate}}% \u2014 oro puro",
    "high-save-ratio.body": "La media dei tatuatori \u00e8 ~2%. Il tuo post {{description}} ha fatto {{rate}}%. Le persone collezionano i tuoi disegni.",
    "best-day.title": "{{day}} \u00e8 il tuo giorno",
    "best-day.body": "I post di {{day}} ottengono {{multiplier}}x pi\u00f9 engagement degli altri giorni. Se lanci un flash nuovo, fallo di {{day}}.",
    "best-hour.title": "Posta intorno alle {{time}} per la massima visibilit\u00e0",
    "best-hour.body": "Il tuo pubblico \u00e8 pi\u00f9 attivo intorno alle {{time}}. I post a quell\u2019ora ottengono {{percent}}% pi\u00f9 engagement.",
    "posting-gap.title": "Sono passati {{days}} giorni dall\u2019ultimo post",
    "posting-gap.body": "L\u2019ultimo post sta perdendo slancio. Una foto veloce di un flash o di un lavoro in corso pu\u00f2 mantenere il ritmo.",
    "posting-gap.action": "Apri Instagram",
    "consistent-posting.title": "Ottimo ritmo \u2014 continua cos\u00ec",
    "consistent-posting.body": "Hai postato {{count}} volte negli ultimi {{period}} giorni. La costanza \u00e8 ci\u00f2 che l\u2019algoritmo premia.",
    "post-drove-bookings.title": "Questo post ha portato {{count}} prenotazioni",
    "post-drove-bookings.body": "Entro {{hours}}h dal post {{description}}, sono arrivate {{count}} richieste. Contenuti cos\u00ec convertono.",
    "post-drove-bookings.action": "Vedi prenotazioni",
    "content-type-bookings.title": "I post {{type}} portano pi\u00f9 prenotazioni",
    "content-type-bookings.body": "I tuoi contenuti {{type}} generano il {{percent}}% delle prenotazioni da Instagram. Punta su questi.",
    "booking-trend-up.title": "Le prenotazioni sono in crescita del {{percent}}%",
    "booking-trend-up.body": "{{thisWeek}} richieste questa settimana contro {{lastWeek}} la scorsa. Qualcosa funziona \u2014 continua a postare.",
    "booking-trend-down.title": "Le prenotazioni sono rallentate",
    "booking-trend-down.body": "{{thisWeek}} richieste questa settimana contro {{lastWeek}} la scorsa. Un nuovo post o una storia potrebbe aiutare.",
    "booking-trend-down.action": "Apri Instagram",
    "no-recent-bookings.title": "Nessuna prenotazione questa settimana",
    "no-recent-bookings.body": "Potrebbe valere la pena condividere dei flash disponibili o un promemoria prenotazioni nelle storie.",
    "portfolio-gap.title": "Questo disegno popolare non \u00e8 prenotabile",
    "portfolio-gap.body": "Il tuo post {{description}} ha avuto {{saves}} salvataggi ma non \u00e8 nel portfolio. Chi lo vuole non pu\u00f2 trovarlo nella pagina di prenotazione.",
    "portfolio-gap.action": "Aggiungi al portfolio",
    "create-fb-page.title": "Raggiungi pi\u00f9 persone gratis con una Pagina Facebook",
    "create-fb-page.body": "Puoi pubblicare automaticamente i tuoi post Instagram su Facebook. Pubblico diverso, zero lavoro extra. Ci vogliono 5 minuti.",
    "create-fb-page.action": "Scopri come",
    "google-presence.title": "Non ti trovano su Google Maps",
    "google-presence.body": "Quando cercano \u201ctatuatrice Malm\u00f6\u201d non appari. Chiedi a Studio Diamant di aggiungerti al loro profilo Google Business.",
    "comments-engagement.title": "I tuoi follower stanno parlando",
    "comments-engagement.body": "Il post {{description}} ha avuto {{comments}} commenti \u2014 {{multiplier}}x la tua media. Rispondere ai commenti aumenta la tua visibilit\u00e0 nell\u2019algoritmo.",
    "low-engagement-tip.title": "Prova a fare una domanda nella didascalia",
    "low-engagement-tip.body": "I tuoi post recenti hanno tanti like ma pochi commenti. Didascalie tipo \u201cquale dovrei tatuare?\u201d possono raddoppiare l\u2019engagement.",
    "summary-header": "Cosa sta succedendo",
    "act-now": "Fai questo adesso",
    "worth-trying": "Vale la pena provare",
    "good-to-know": "Buono a sapersi",
    "no-insights": "Non ci sono ancora abbastanza dati. Quando Instagram \u00e8 collegato e hai qualche prenotazione, gli insight appariranno qui.",
    "powered-by": "Basato sui tuoi ultimi {{count}} post e {{bookings}} prenotazioni",
    "language-label": "Lingua",
    "show-details": "Mostra dettagli",
    "hide-details": "Nascondi dettagli",
  },
  sv: {
    "top-post.title": "Den h\u00e4r slog igenom",
    "top-post.body": "Ditt {{description}}-inl\u00e4gg n\u00e5dde {{reach}} personer \u2014 det \u00e4r {{multiplier}}x ditt genomsnitt. Mer s\u00e5dant inneh\u00e5ll kan verkligen v\u00e4xa din publik.",
    "top-post.action": "Visa inl\u00e4gget",
    "best-content-type.title": "{{winner}} \u00e4r din superkraft",
    "best-content-type.body": "Dina {{winner}}-inl\u00e4gg f\u00e5r {{multiplier}}x mer engagemang \u00e4n {{loser}}. N\u00e4r du \u00e4r os\u00e4ker, k\u00f6r en {{winnerLower}}.",
    "best-content-type.action": "Se datan",
    "saves-signal.title": "{{count}} personer sparade din {{description}}",
    "saves-signal.body": "Att spara betyder \u201cjag vill ha den h\u00e4r tatueringen.\u201d Designen \u00e4r efterfr\u00e5gad \u2014 se till att den g\u00e5r att boka.",
    "saves-signal.action": "L\u00e4gg till i portfolio",
    "high-save-ratio.title": "Din sparkvot \u00e4r {{rate}}% \u2014 det \u00e4r guld",
    "high-save-ratio.body": "Genomsnittet f\u00f6r tatuerare \u00e4r ~2%. Ditt {{description}}-inl\u00e4gg n\u00e5dde {{rate}}%. Folk samlar dina designs.",
    "best-day.title": "{{day}} \u00e4r din dag",
    "best-day.body": "Inl\u00e4gg p\u00e5 {{day}} f\u00e5r {{multiplier}}x mer engagemang. Ska du sl\u00e4ppa ny flash? G\u00f6r det p\u00e5 {{day}}.",
    "best-hour.title": "Posta runt {{time}} f\u00f6r maximal r\u00e4ckvidd",
    "best-hour.body": "Din publik \u00e4r mest aktiv runt {{time}}. Inl\u00e4gg d\u00e5 f\u00e5r {{percent}}% mer engagemang.",
    "posting-gap.title": "Det har g\u00e5tt {{days}} dagar sedan ditt senaste inl\u00e4gg",
    "posting-gap.body": "Ditt senaste inl\u00e4gg tappar fart. Ett snabbt flashfoto eller work-in-progress kan h\u00e5lla ig\u00e5ng momentumet.",
    "posting-gap.action": "\u00d6ppna Instagram",
    "consistent-posting.title": "Bra rytm \u2014 forts\u00e4tt s\u00e5",
    "consistent-posting.body": "Du har postat {{count}} g\u00e5nger de senaste {{period}} dagarna. Konsistens \u00e4r vad algoritmen bel\u00f6nar.",
    "post-drove-bookings.title": "Det h\u00e4r inl\u00e4gget gav {{count}} bokningar",
    "post-drove-bookings.body": "Inom {{hours}}h efter ditt {{description}}-inl\u00e4gg kom {{count}} bokningsf\u00f6rfr\u00e5gningar. S\u00e5dant inneh\u00e5ll konverterar.",
    "post-drove-bookings.action": "Visa bokningar",
    "content-type-bookings.title": "{{type}}-inl\u00e4gg ger flest bokningar",
    "content-type-bookings.body": "Dina {{type}}-inl\u00e4gg leder till {{percent}}% av bokningarna fr\u00e5n Instagram. Satsa p\u00e5 dessa.",
    "booking-trend-up.title": "Bokningarna \u00f6kade med {{percent}}%",
    "booking-trend-up.body": "{{thisWeek}} f\u00f6rfr\u00e5gningar den h\u00e4r veckan mot {{lastWeek}} f\u00f6rra veckan. N\u00e5got funkar \u2014 forts\u00e4tt posta.",
    "booking-trend-down.title": "Bokningarna har saktat ner",
    "booking-trend-down.body": "{{thisWeek}} f\u00f6rfr\u00e5gningar den h\u00e4r veckan mot {{lastWeek}} f\u00f6rra. Ett nytt inl\u00e4gg eller en story kan hj\u00e4lpa.",
    "booking-trend-down.action": "\u00d6ppna Instagram",
    "no-recent-bookings.title": "Inga bokningar den h\u00e4r veckan \u00e4nnu",
    "no-recent-bookings.body": "Det kan vara v\u00e4rt att dela tillg\u00e4nglig flash eller en bokningsp\u00e5minnelse i dina stories.",
    "portfolio-gap.title": "Denna popul\u00e4ra design g\u00e5r inte att boka",
    "portfolio-gap.body": "Ditt {{description}}-inl\u00e4gg fick {{saves}} sparningar men finns inte i portfolion. De som vill ha den kan inte hitta den p\u00e5 bokningssidan.",
    "portfolio-gap.action": "L\u00e4gg till i portfolio",
    "create-fb-page.title": "N\u00e5 fler gratis med en Facebook-sida",
    "create-fb-page.body": "Du kan autopublicera dina Instagram-inl\u00e4gg till Facebook. Annan publik, noll extra jobb. Tar 5 minuter.",
    "create-fb-page.action": "L\u00e4s mer",
    "google-presence.title": "Folk hittar dig inte p\u00e5 Google Maps",
    "google-presence.body": "N\u00e4r folk s\u00f6ker \u201ctatuerare Malm\u00f6\u201d syns du inte. Be Studio Diamant att l\u00e4gga till dig p\u00e5 deras Google Business-profil.",
    "comments-engagement.title": "Dina f\u00f6ljare pratar",
    "comments-engagement.body": "Ditt {{description}}-inl\u00e4gg fick {{comments}} kommentarer \u2014 {{multiplier}}x ditt genomsnitt. Att svara p\u00e5 kommentarer \u00f6kar din synlighet i algoritmen.",
    "low-engagement-tip.title": "Testa att st\u00e4lla en fr\u00e5ga i bildtexten",
    "low-engagement-tip.body": "Dina senaste inl\u00e4gg f\u00e5r mycket likes men f\u00e5 kommentarer. Bildtexter som fr\u00e5gar \u201cvilken ska jag tatuera h\u00e4rn\u00e4st?\u201d kan dubblera engagemanget.",
    "summary-header": "Vad som h\u00e4nder",
    "act-now": "G\u00f6r detta nu",
    "worth-trying": "V\u00e4rt att testa",
    "good-to-know": "Bra att veta",
    "no-insights": "Inte tillr\u00e4ckligt med data \u00e4nnu. N\u00e4r Instagram \u00e4r anslutet och du har lite bokningar dyker insikter upp h\u00e4r.",
    "powered-by": "Baserat p\u00e5 dina senaste {{count}} inl\u00e4gg och {{bookings}} bokningar",
    "language-label": "Spr\u00e5k",
    "show-details": "Visa detaljer",
    "hide-details": "D\u00f6lj detaljer",
  },
};

// ── Helpers ──────────────────────────────────────────────

function t(locale: CoachLocale, key: string, vars?: Record<string, string>): string {
  let str = STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
    }
  }
  return str;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const PRIORITY_CONFIG: Record<InsightPriority, { color: string; bgColor: string; label: string }> = {
  "act-now": { color: "text-red-700", bgColor: "bg-red-50 border-red-200", label: "act-now" },
  "worth-trying": { color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200", label: "worth-trying" },
  "good-to-know": { color: "text-green-700", bgColor: "bg-green-50 border-green-200", label: "good-to-know" },
};

// ── Dismissal persistence ───────────────────────────────

function getDismissedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("coach-dismissed");
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function dismissCard(id: string) {
  const dismissed = getDismissedIds();
  dismissed.add(id);
  localStorage.setItem("coach-dismissed", JSON.stringify([...dismissed]));
}

// ── Card Component ──────────────────────────────────────

function CoachCard({
  card,
  locale,
  onDismiss,
}: {
  card: InsightCard;
  locale: CoachLocale;
  onDismiss: (id: string) => void;
}) {
  const [showData, setShowData] = useState(false);
  const config = PRIORITY_CONFIG[card.priority];

  const title = t(locale, card.titleKey, card.vars);
  const body = t(locale, card.bodyKey, card.vars);
  const actionLabel = card.action ? t(locale, card.action.labelKey, card.vars) : null;

  return (
    <div className={`border rounded-lg p-4 sm:p-5 ${config.bgColor} transition-all`}>
      {/* Header row: icon + title + dismiss */}
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 mt-0.5" role="img">
          {card.icon}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm sm:text-base ${config.color}`}>
            {title}
          </h3>
          <p className="text-sm text-ink-900/70 mt-1 leading-relaxed">
            {body}
          </p>

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {card.action?.href && (
              <a
                href={card.action.href}
                target={card.action.type === "external" ? "_blank" : undefined}
                rel={card.action.type === "external" ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-[var(--ink-900)] text-[var(--sabbia-50)] hover:bg-[var(--ink-900)]/90 transition-colors min-h-[36px]"
              >
                {actionLabel}
                {card.action.type === "external" && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4.5 1.5H10.5V7.5M10.5 1.5L1.5 10.5" />
                  </svg>
                )}
              </a>
            )}

            {card.dataPoints && card.dataPoints.length > 0 && (
              <button
                onClick={() => setShowData(!showData)}
                className="text-xs text-ink-900/50 hover:text-ink-900/70 transition-colors min-h-[36px] px-1"
              >
                {showData ? t(locale, "hide-details") : t(locale, "show-details")}
              </button>
            )}
          </div>

          {/* Expandable data points */}
          {showData && card.dataPoints && (
            <div className="mt-3 pt-3 border-t border-ink-900/10">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {card.dataPoints.map((dp, i) => (
                  <div key={i} className="text-xs">
                    <span className="text-ink-900/40 block">{dp.label}</span>
                    <span className="text-ink-900/70 font-medium">{dp.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => onDismiss(card.id)}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-ink-900/30 hover:text-ink-900/60 transition-colors rounded-full hover:bg-ink-900/5"
          title="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3L11 11M11 3L3 11" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Priority Section Component ──────────────────────────

function PrioritySection({
  priority,
  cards,
  locale,
  onDismiss,
}: {
  priority: InsightPriority;
  cards: InsightCard[];
  locale: CoachLocale;
  onDismiss: (id: string) => void;
}) {
  if (cards.length === 0) return null;

  const config = PRIORITY_CONFIG[priority];
  const dots: Record<InsightPriority, string> = {
    "act-now": "bg-red-500",
    "worth-trying": "bg-amber-500",
    "good-to-know": "bg-green-500",
  };

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-full ${dots[priority]}`} />
        <h2 className={`text-xs font-semibold uppercase tracking-wider ${config.color}`}>
          {t(locale, config.label)}
        </h2>
        <span className="text-xs text-ink-900/30">({cards.length})</span>
      </div>
      <div className="space-y-3">
        {cards.map((card) => (
          <CoachCard
            key={card.id}
            card={card}
            locale={locale}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </section>
  );
}

// ── Main Component ──────────────────────────────────────

export default function AdminInsights() {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [locale, setLocale] = useState<CoachLocale>("en");

  // Load locale + dismissed from localStorage
  useEffect(() => {
    setDismissed(getDismissedIds());
    const savedLocale = localStorage.getItem("coach-locale") as CoachLocale | null;
    if (savedLocale && ["en", "it", "sv"].includes(savedLocale)) {
      setLocale(savedLocale);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/instagram?action=status");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      setStatus(data.status);
    } catch {
      setError("Failed to check Instagram connection");
    }
  }, [router]);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/instagram?action=insights&limit=50");
      if (res.ok) {
        const data: InsightsResponse = await res.json();
        setInsights(data);
      }
    } catch {
      // Silent — status already shows connection issues
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // First refresh the IG cache, then regenerate insights
      const refreshRes = await fetch("/api/admin/instagram?action=refresh&limit=50");
      if (!refreshRes.ok) {
        const data = await refreshRes.json();
        setError(data.error || "Refresh failed");
        return;
      }
      // Re-fetch insights with fresh data
      await Promise.all([fetchStatus(), fetchInsights()]);
    } catch {
      setError("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDismiss = (id: string) => {
    dismissCard(id);
    setDismissed((prev) => new Set([...prev, id]));
  };

  const handleLocaleChange = (newLocale: CoachLocale) => {
    setLocale(newLocale);
    localStorage.setItem("coach-locale", newLocale);
  };

  useEffect(() => {
    Promise.all([fetchStatus(), fetchInsights()]).finally(() =>
      setLoading(false),
    );
  }, [fetchStatus, fetchInsights]);

  // Filter dismissed cards
  const visibleInsights = insights?.insights.filter((c) => !dismissed.has(c.id)) ?? [];
  const actNow = visibleInsights.filter((c) => c.priority === "act-now");
  const worthTrying = visibleInsights.filter((c) => c.priority === "worth-trying");
  const goodToKnow = visibleInsights.filter((c) => c.priority === "good-to-know");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-ink-900/20 border-t-ink-900/60 rounded-full animate-spin mb-3" />
          <p className="text-foreground-muted text-sm">Loading your creative coach...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-normal text-ink-900">
            CREATIVE COACH
          </h1>
          <p className="text-sm text-foreground-muted">
            Your Instagram + booking insights
          </p>
        </div>
        <button
          onClick={() => {
            document.cookie = "sb-access-token=; path=/; max-age=0";
            document.cookie = "sb-refresh-token=; path=/; max-age=0";
            router.push("/admin/login");
          }}
          className="text-sm text-foreground-muted hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-end"
        >
          Sign out
        </button>
      </div>

      {/* Admin nav */}
      <div className="flex gap-2 mb-4 sm:mb-6">
        <Link
          href="/admin"
          className="px-3 py-1.5 text-xs rounded-full bg-[var(--sabbia-100)] text-foreground-muted hover:bg-[var(--sabbia-200)] transition-colors"
        >
          Bookings
        </Link>
        <Link
          href="/admin/portfolio"
          className="px-3 py-1.5 text-xs rounded-full bg-[var(--sabbia-100)] text-foreground-muted hover:bg-[var(--sabbia-200)] transition-colors"
        >
          Portfolio
        </Link>
        <span className="px-3 py-1.5 text-xs rounded-full bg-[var(--ink-900)] text-[var(--sabbia-50)]">
          Creative Coach
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {/* ── Not Connected State ──────────────────────── */}
      {status && !status.connected && (
        <div className="border border-ink-900/10 rounded-lg p-6 sm:p-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--sabbia-100)] mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-900/40">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1.5" />
            </svg>
          </div>

          <h2 className="font-display text-xl font-normal text-ink-900 mb-2">
            INSTAGRAM NOT CONNECTED
          </h2>
          <p className="text-sm text-foreground-muted max-w-md mx-auto mb-8">
            {status.reason}
          </p>

          <div className="text-left max-w-lg mx-auto space-y-4 text-sm text-foreground-muted">
            <h3 className="font-semibold text-ink-900">Setup steps:</h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Go to{" "}
                <a
                  href="https://developers.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent-hover underline"
                >
                  Meta Developer Portal
                </a>{" "}
                and create an app (type: Business)
              </li>
              <li>Add &quot;Instagram Graph API&quot; product to the app</li>
              <li>
                Ensure @liagiorgi.one.ttt is a{" "}
                <strong>Business or Creator</strong> account
              </li>
              <li>
                Generate a short-lived token via the Graph API Explorer with
                permissions:{" "}
                <code className="bg-[var(--sabbia-100)] px-1.5 py-0.5 rounded text-xs">
                  instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement
                </code>
              </li>
              <li>
                Use the setup endpoint to exchange it for a long-lived token
                (auto-refreshes every 60 days)
              </li>
            </ol>

            <div className="mt-6 p-4 bg-[var(--sabbia-100)] rounded text-xs font-mono">
              <p className="text-ink-900/60 mb-2">
                # After getting the short-lived token, call:
              </p>
              <p>
                POST /api/admin/instagram
              </p>
              <pre className="mt-1 whitespace-pre-wrap">
{`{
  "action": "setup",
  "shortLivedToken": "IGQ...",
  "appSecret": "your-app-secret",
  "instagramUserId": "17841400..."
}`}
              </pre>
            </div>
          </div>

          {/* Even without IG, show booking-only insights */}
          {insights && insights.insights.length > 0 && (
            <div className="mt-10 pt-8 border-t border-ink-900/10 text-left">
              <h3 className="text-sm font-semibold text-ink-900 mb-4">
                Meanwhile, from your bookings:
              </h3>
              {insights.insights
                .filter((c) => c.category === "booking" && !dismissed.has(c.id))
                .slice(0, 3)
                .map((card) => (
                  <div key={card.id} className="mb-3">
                    <CoachCard card={card} locale={locale} onDismiss={handleDismiss} />
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Connected State ──────────────────────────── */}
      {status && status.connected && (
        <>
          {/* Connection bar + language toggle */}
          <div className="flex flex-wrap items-center gap-3 mb-6 text-xs text-foreground-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Connected
            </span>
            {status.lastFetchedAt && (
              <span>Synced {timeAgo(status.lastFetchedAt)}</span>
            )}
            <span>
              Token expires {formatDate(status.tokenExpiresAt)}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Language toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-ink-900/40">{t(locale, "language-label")}:</span>
              {(["en", "it", "sv"] as CoachLocale[]).map((l) => (
                <button
                  key={l}
                  onClick={() => handleLocaleChange(l)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    locale === l
                      ? "bg-[var(--ink-900)] text-[var(--sabbia-50)]"
                      : "bg-[var(--sabbia-100)] hover:bg-[var(--sabbia-200)]"
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Sync button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 text-xs rounded-full bg-[var(--sabbia-100)] hover:bg-[var(--sabbia-200)] transition-colors disabled:opacity-50"
            >
              {refreshing ? "Syncing..." : "Sync now"}
            </button>
          </div>

          {/* Summary bar */}
          {insights && (
            <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-lg bg-[var(--sabbia-100)]/50 border border-ink-900/5 text-xs text-ink-900/60">
              <span>{insights.summary.totalPosts} posts</span>
              <span>{insights.summary.totalBookings} bookings</span>
              <span>{insights.summary.portfolioCount} portfolio items</span>
              <span>Avg engagement: {insights.summary.avgEngagementRate}</span>
              <span>This week: {insights.summary.bookingsThisWeek} bookings</span>
            </div>
          )}

          {/* Insight cards */}
          {visibleInsights.length > 0 ? (
            <>
              <PrioritySection
                priority="act-now"
                cards={actNow}
                locale={locale}
                onDismiss={handleDismiss}
              />
              <PrioritySection
                priority="worth-trying"
                cards={worthTrying}
                locale={locale}
                onDismiss={handleDismiss}
              />
              <PrioritySection
                priority="good-to-know"
                cards={goodToKnow}
                locale={locale}
                onDismiss={handleDismiss}
              />

              {/* Footer attribution */}
              <p className="text-center text-xs text-ink-900/30 mt-8 mb-4">
                {t(locale, "powered-by", {
                  count: String(insights?.summary.totalPosts ?? 0),
                  bookings: String(insights?.summary.totalBookings ?? 0),
                })}
              </p>

              {/* Reset dismissed */}
              {dismissed.size > 0 && (
                <div className="text-center mb-8">
                  <button
                    onClick={() => {
                      localStorage.removeItem("coach-dismissed");
                      setDismissed(new Set());
                    }}
                    className="text-xs text-ink-900/30 hover:text-ink-900/50 transition-colors underline"
                  >
                    Show {dismissed.size} dismissed insight{dismissed.size > 1 ? "s" : ""}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-foreground-muted">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--sabbia-100)] mb-4">
                <span className="text-3xl">🔮</span>
              </div>
              <p className="text-sm max-w-sm mx-auto">
                {t(locale, "no-insights")}
              </p>
              {dismissed.size > 0 && (
                <button
                  onClick={() => {
                    localStorage.removeItem("coach-dismissed");
                    setDismissed(new Set());
                  }}
                  className="mt-4 text-xs text-ink-900/40 hover:text-ink-900/60 underline"
                >
                  Show {dismissed.size} dismissed insight{dismissed.size > 1 ? "s" : ""}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
