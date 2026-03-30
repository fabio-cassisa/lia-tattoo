/**
 * Insight i18n strings — EN, IT, SV.
 *
 * These are the "voice" of the creative coach.
 * Tone: warm, direct, like a friend who's good with numbers.
 * Variables use {{varName}} syntax.
 */

import type { InsightLocale } from "./insight-types";

type StringMap = Record<string, string>;

const en: StringMap = {
  // ── Content Performance ──────────────────────────
  "top-post.title": "This one hit different",
  "top-post.body":
    "Your {{description}} post reached {{reach}} people — that's {{multiplier}}x your average. More content like this could really grow your audience.",
  "top-post.action": "View post",

  "best-content-type.title": "{{winner}}s are your superpower",
  "best-content-type.body":
    "Your {{winner}} posts get {{multiplier}}x more engagement than {{loser}}s. When in doubt, go with a {{winnerLower}}.",
  "best-content-type.action": "See the data",

  "saves-signal.title": "{{count}} people saved your {{description}}",
  "saves-signal.body":
    "Saves mean \"I want this tattoo.\" This design is in demand — make sure it's available to book.",
  "saves-signal.action": "Add to portfolio",

  "high-save-ratio.title": "Your save rate is {{rate}}% — that's gold",
  "high-save-ratio.body":
    "The average tattoo artist gets ~2% saves. Your {{description}} post hit {{rate}}%. People are collecting your designs.",

  // ── Timing ───────────────────────────────────────
  "best-day.title": "{{day}} is your day",
  "best-day.body":
    "Posts on {{day}} get {{multiplier}}x more engagement than other days. If you're dropping new flash, {{day}} is the move.",

  "best-hour.title": "Post around {{time}} for maximum reach",
  "best-hour.body":
    "Your audience is most active around {{time}}. Posts at that time get {{percent}}% more engagement.",

  "posting-gap.title": "It's been {{days}} days since your last post",
  "posting-gap.body":
    "Your last post is losing steam. A quick flash photo or work-in-progress could keep the momentum going.",
  "posting-gap.action": "Open Instagram",

  "consistent-posting.title": "Great rhythm — keep it up",
  "consistent-posting.body":
    "You've posted {{count}} times in the last {{period}} days. Consistency is what the algorithm rewards.",

  // ── Booking Correlation ──────────────────────────
  "post-drove-bookings.title": "This post brought in {{count}} bookings",
  "post-drove-bookings.body":
    "Within {{hours}}h of posting your {{description}}, {{count}} booking requests came in. Content like this converts.",
  "post-drove-bookings.action": "View bookings",

  "content-type-bookings.title": "{{type}} posts drive the most bookings",
  "content-type-bookings.body":
    "Your {{type}} content leads to {{percent}}% of bookings that come from Instagram. Double down on these.",

  "booking-trend-up.title": "Bookings are up {{percent}}%",
  "booking-trend-up.body":
    "You got {{thisWeek}} booking requests this week vs {{lastWeek}} last week. Something's working — keep posting.",

  "booking-trend-down.title": "Bookings slowed down this week",
  "booking-trend-down.body":
    "{{thisWeek}} requests this week vs {{lastWeek}} last week. A new post or story could help pick things up.",
  "booking-trend-down.action": "Open Instagram",

  "no-recent-bookings.title": "No bookings this week yet",
  "no-recent-bookings.body":
    "It might be worth sharing some available flash or a booking reminder in your stories.",

  // ── Portfolio & Growth ───────────────────────────
  "portfolio-gap.title": "This popular design isn't bookable",
  "portfolio-gap.body":
    "Your {{description}} post got {{saves}} saves but it's not in your portfolio. People who want it can't find it on your booking page.",
  "portfolio-gap.action": "Add to portfolio",

  "create-fb-page.title": "Reach more people for free with a Facebook Page",
  "create-fb-page.body":
    "You can auto-publish your Instagram posts to Facebook. Different audience, zero extra work. Takes 5 minutes to set up.",
  "create-fb-page.action": "Learn how",

  "google-presence.title": "People can't find you on Google Maps",
  "google-presence.body":
    "When people search \"tattoo artist Malmö\", you don't show up. Ask Studio Diamant to add you to their Google Business listing.",

  // ── Engagement Quality ───────────────────────────
  "comments-engagement.title": "Your followers are talking",
  "comments-engagement.body":
    "Your {{description}} post got {{comments}} comments — that's {{multiplier}}x your average. Replying to comments boosts your visibility in the algorithm.",

  "low-engagement-tip.title": "Try asking a question in your caption",
  "low-engagement-tip.body":
    "Your recent posts get lots of likes but few comments. Captions that ask \"which one should I tattoo next?\" can double your engagement.",

  // ── General ──────────────────────────────────────
  "summary-header": "What's happening",
  "act-now": "Do this now",
  "worth-trying": "Worth trying",
  "good-to-know": "Good to know",
  "no-insights": "Not enough data yet. Once you connect Instagram and have some bookings, insights will appear here.",
  "powered-by": "Based on your last {{count}} posts and {{bookings}} bookings",
  "language-label": "Language",
  "raw-data": "Raw data",
  "show-details": "Show details",
  "hide-details": "Hide details",
};

const it: StringMap = {
  // ── Content Performance ──────────────────────────
  "top-post.title": "Questo ha spaccato",
  "top-post.body":
    "Il tuo post {{description}} ha raggiunto {{reach}} persone — {{multiplier}}x la tua media. Più contenuti così possono far crescere il tuo pubblico.",
  "top-post.action": "Vedi il post",

  "best-content-type.title": "I {{winner}} sono il tuo superpotere",
  "best-content-type.body":
    "I tuoi post {{winner}} ottengono {{multiplier}}x più engagement dei {{loser}}. Nel dubbio, vai con un {{winnerLower}}.",
  "best-content-type.action": "Vedi i dati",

  "saves-signal.title": "{{count}} persone hanno salvato il tuo {{description}}",
  "saves-signal.body":
    "Salvare significa \"lo voglio\". Questo disegno è richiesto — assicurati che sia prenotabile.",
  "saves-signal.action": "Aggiungi al portfolio",

  "high-save-ratio.title": "Il tuo tasso di salvataggio è {{rate}}% — oro puro",
  "high-save-ratio.body":
    "La media dei tatuatori è ~2%. Il tuo post {{description}} ha fatto {{rate}}%. Le persone collezionano i tuoi disegni.",

  // ── Timing ───────────────────────────────────────
  "best-day.title": "{{day}} è il tuo giorno",
  "best-day.body":
    "I post di {{day}} ottengono {{multiplier}}x più engagement degli altri giorni. Se lanci un flash nuovo, fallo di {{day}}.",

  "best-hour.title": "Posta intorno alle {{time}} per la massima visibilità",
  "best-hour.body":
    "Il tuo pubblico è più attivo intorno alle {{time}}. I post a quell'ora ottengono {{percent}}% più engagement.",

  "posting-gap.title": "Sono passati {{days}} giorni dall'ultimo post",
  "posting-gap.body":
    "L'ultimo post sta perdendo slancio. Una foto veloce di un flash o di un lavoro in corso può mantenere il ritmo.",
  "posting-gap.action": "Apri Instagram",

  "consistent-posting.title": "Ottimo ritmo — continua così",
  "consistent-posting.body":
    "Hai postato {{count}} volte negli ultimi {{period}} giorni. La costanza è ciò che l'algoritmo premia.",

  // ── Booking Correlation ──────────────────────────
  "post-drove-bookings.title": "Questo post ha portato {{count}} prenotazioni",
  "post-drove-bookings.body":
    "Entro {{hours}}h dal post {{description}}, sono arrivate {{count}} richieste. Contenuti così convertono.",
  "post-drove-bookings.action": "Vedi prenotazioni",

  "content-type-bookings.title": "I post {{type}} portano più prenotazioni",
  "content-type-bookings.body":
    "I tuoi contenuti {{type}} generano il {{percent}}% delle prenotazioni da Instagram. Punta su questi.",

  "booking-trend-up.title": "Le prenotazioni sono in crescita del {{percent}}%",
  "booking-trend-up.body":
    "{{thisWeek}} richieste questa settimana contro {{lastWeek}} la scorsa. Qualcosa funziona — continua a postare.",

  "booking-trend-down.title": "Le prenotazioni sono rallentate",
  "booking-trend-down.body":
    "{{thisWeek}} richieste questa settimana contro {{lastWeek}} la scorsa. Un nuovo post o una storia potrebbe aiutare.",
  "booking-trend-down.action": "Apri Instagram",

  "no-recent-bookings.title": "Nessuna prenotazione questa settimana",
  "no-recent-bookings.body":
    "Potrebbe valere la pena condividere dei flash disponibili o un promemoria prenotazioni nelle storie.",

  // ── Portfolio & Growth ───────────────────────────
  "portfolio-gap.title": "Questo disegno popolare non è prenotabile",
  "portfolio-gap.body":
    "Il tuo post {{description}} ha avuto {{saves}} salvataggi ma non è nel portfolio. Chi lo vuole non può trovarlo nella pagina di prenotazione.",
  "portfolio-gap.action": "Aggiungi al portfolio",

  "create-fb-page.title": "Raggiungi più persone gratis con una Pagina Facebook",
  "create-fb-page.body":
    "Puoi pubblicare automaticamente i tuoi post Instagram su Facebook. Pubblico diverso, zero lavoro extra. Ci vogliono 5 minuti.",
  "create-fb-page.action": "Scopri come",

  "google-presence.title": "Non ti trovano su Google Maps",
  "google-presence.body":
    "Quando cercano \"tatuatrice Malmö\" non appari. Chiedi a Studio Diamant di aggiungerti al loro profilo Google Business.",

  // ── Engagement Quality ───────────────────────────
  "comments-engagement.title": "I tuoi follower stanno parlando",
  "comments-engagement.body":
    "Il post {{description}} ha avuto {{comments}} commenti — {{multiplier}}x la tua media. Rispondere ai commenti aumenta la tua visibilità nell'algoritmo.",

  "low-engagement-tip.title": "Prova a fare una domanda nella didascalia",
  "low-engagement-tip.body":
    "I tuoi post recenti hanno tanti like ma pochi commenti. Didascalie tipo \"quale dovrei tatuare?\" possono raddoppiare l'engagement.",

  // ── General ──────────────────────────────────────
  "summary-header": "Cosa sta succedendo",
  "act-now": "Fai questo adesso",
  "worth-trying": "Vale la pena provare",
  "good-to-know": "Buono a sapersi",
  "no-insights": "Non ci sono ancora abbastanza dati. Quando Instagram è collegato e hai qualche prenotazione, gli insight appariranno qui.",
  "powered-by": "Basato sui tuoi ultimi {{count}} post e {{bookings}} prenotazioni",
  "language-label": "Lingua",
  "raw-data": "Dati grezzi",
  "show-details": "Mostra dettagli",
  "hide-details": "Nascondi dettagli",
};

const sv: StringMap = {
  // ── Content Performance ──────────────────────────
  "top-post.title": "Den här slog igenom",
  "top-post.body":
    "Ditt {{description}}-inlägg nådde {{reach}} personer — det är {{multiplier}}x ditt genomsnitt. Mer sådant innehåll kan verkligen växa din publik.",
  "top-post.action": "Visa inlägget",

  "best-content-type.title": "{{winner}} är din superkraft",
  "best-content-type.body":
    "Dina {{winner}}-inlägg får {{multiplier}}x mer engagemang än {{loser}}. När du är osäker, kör en {{winnerLower}}.",
  "best-content-type.action": "Se datan",

  "saves-signal.title": "{{count}} personer sparade din {{description}}",
  "saves-signal.body":
    "Att spara betyder \"jag vill ha den här tatueringen.\" Designen är efterfrågad — se till att den går att boka.",
  "saves-signal.action": "Lägg till i portfolio",

  "high-save-ratio.title": "Din sparkvot är {{rate}}% — det är guld",
  "high-save-ratio.body":
    "Genomsnittet för tatuerare är ~2%. Ditt {{description}}-inlägg nådde {{rate}}%. Folk samlar dina designs.",

  // ── Timing ───────────────────────────────────────
  "best-day.title": "{{day}} är din dag",
  "best-day.body":
    "Inlägg på {{day}} får {{multiplier}}x mer engagemang. Ska du släppa ny flash? Gör det på {{day}}.",

  "best-hour.title": "Posta runt {{time}} för maximal räckvidd",
  "best-hour.body":
    "Din publik är mest aktiv runt {{time}}. Inlägg då får {{percent}}% mer engagemang.",

  "posting-gap.title": "Det har gått {{days}} dagar sedan ditt senaste inlägg",
  "posting-gap.body":
    "Ditt senaste inlägg tappar fart. Ett snabbt flashfoto eller work-in-progress kan hålla igång momentumet.",
  "posting-gap.action": "Öppna Instagram",

  "consistent-posting.title": "Bra rytm — fortsätt så",
  "consistent-posting.body":
    "Du har postat {{count}} gånger de senaste {{period}} dagarna. Konsistens är vad algoritmen belönar.",

  // ── Booking Correlation ──────────────────────────
  "post-drove-bookings.title": "Det här inlägget gav {{count}} bokningar",
  "post-drove-bookings.body":
    "Inom {{hours}}h efter ditt {{description}}-inlägg kom {{count}} bokningsförfrågningar. Sådant innehåll konverterar.",
  "post-drove-bookings.action": "Visa bokningar",

  "content-type-bookings.title": "{{type}}-inlägg ger flest bokningar",
  "content-type-bookings.body":
    "Dina {{type}}-inlägg leder till {{percent}}% av bokningarna från Instagram. Satsa på dessa.",

  "booking-trend-up.title": "Bokningarna ökade med {{percent}}%",
  "booking-trend-up.body":
    "{{thisWeek}} förfrågningar den här veckan mot {{lastWeek}} förra veckan. Något funkar — fortsätt posta.",

  "booking-trend-down.title": "Bokningarna har saktat ner",
  "booking-trend-down.body":
    "{{thisWeek}} förfrågningar den här veckan mot {{lastWeek}} förra. Ett nytt inlägg eller en story kan hjälpa.",
  "booking-trend-down.action": "Öppna Instagram",

  "no-recent-bookings.title": "Inga bokningar den här veckan ännu",
  "no-recent-bookings.body":
    "Det kan vara värt att dela tillgänglig flash eller en bokningspåminnelse i dina stories.",

  // ── Portfolio & Growth ───────────────────────────
  "portfolio-gap.title": "Denna populära design går inte att boka",
  "portfolio-gap.body":
    "Ditt {{description}}-inlägg fick {{saves}} sparningar men finns inte i portfolion. De som vill ha den kan inte hitta den på bokningssidan.",
  "portfolio-gap.action": "Lägg till i portfolio",

  "create-fb-page.title": "Nå fler gratis med en Facebook-sida",
  "create-fb-page.body":
    "Du kan autopublicera dina Instagram-inlägg till Facebook. Annan publik, noll extra jobb. Tar 5 minuter.",
  "create-fb-page.action": "Läs mer",

  "google-presence.title": "Folk hittar dig inte på Google Maps",
  "google-presence.body":
    "När folk söker \"tatuerare Malmö\" syns du inte. Be Studio Diamant att lägga till dig på deras Google Business-profil.",

  // ── Engagement Quality ───────────────────────────
  "comments-engagement.title": "Dina följare pratar",
  "comments-engagement.body":
    "Ditt {{description}}-inlägg fick {{comments}} kommentarer — {{multiplier}}x ditt genomsnitt. Att svara på kommentarer ökar din synlighet i algoritmen.",

  "low-engagement-tip.title": "Testa att ställa en fråga i bildtexten",
  "low-engagement-tip.body":
    "Dina senaste inlägg får mycket likes men få kommentarer. Bildtexter som frågar \"vilken ska jag tatuera härnäst?\" kan dubblera engagemanget.",

  // ── General ──────────────────────────────────────
  "summary-header": "Vad som händer",
  "act-now": "Gör detta nu",
  "worth-trying": "Värt att testa",
  "good-to-know": "Bra att veta",
  "no-insights": "Inte tillräckligt med data ännu. När Instagram är anslutet och du har lite bokningar dyker insikter upp här.",
  "powered-by": "Baserat på dina senaste {{count}} inlägg och {{bookings}} bokningar",
  "language-label": "Språk",
  "raw-data": "Rådata",
  "show-details": "Visa detaljer",
  "hide-details": "Dölj detaljer",
};

const strings: Record<InsightLocale, StringMap> = { en, it, sv };

/**
 * Resolve an i18n key with variable interpolation.
 * Variables use {{varName}} syntax.
 */
export function t(
  locale: InsightLocale,
  key: string,
  vars?: Record<string, string>,
): string {
  let str = strings[locale]?.[key] ?? strings.en[key] ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
    }
  }

  return str;
}

/**
 * Get all strings for a locale (for client-side use).
 */
export function getStrings(locale: InsightLocale): StringMap {
  return { ...strings.en, ...strings[locale] };
}
