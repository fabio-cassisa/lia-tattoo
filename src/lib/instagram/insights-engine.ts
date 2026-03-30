/**
 * Creative Coach Insights Engine.
 *
 * Pure logic — takes cached IG media + bookings + portfolio as inputs,
 * runs analyzers, and returns prioritized InsightCard[].
 *
 * No Supabase calls here. The API route handles data fetching.
 */

import type { CachedMediaRow, MediaType } from "./types";
import type { BookingRow, PortfolioImageRow } from "@/lib/supabase/database.types";
import type { InsightCard, InsightsResponse, InsightPriority } from "./insight-types";

// ── Helper types ────────────────────────────────────────

type AnalyzerInput = {
  media: CachedMediaRow[];
  bookings: BookingRow[];
  portfolio: PortfolioImageRow[];
};

type Analyzer = (input: AnalyzerInput) => InsightCard[];

// ── Constants ───────────────────────────────────────────

const BOOKING_CORRELATION_WINDOW_H = 72;
const POSTING_GAP_WARN_DAYS = 7;
const MIN_POSTS_FOR_ANALYSIS = 3;
const MIN_SAVES_THRESHOLD = 3;
const ENGAGEMENT_MULTIPLIER_THRESHOLD = 2;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ── Utility functions ───────────────────────────────────

function engagementRate(m: CachedMediaRow): number {
  const total = (m.like_count ?? 0) + (m.comments_count ?? 0) + (m.saved ?? 0) + (m.shares ?? 0);
  const reach = m.reach ?? m.impressions ?? 0;
  if (reach === 0) return 0;
  return total / reach;
}

function totalEngagement(m: CachedMediaRow): number {
  return (m.like_count ?? 0) + (m.comments_count ?? 0) + (m.saved ?? 0) + (m.shares ?? 0);
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function captionPreview(caption: string | null, maxLen = 30): string {
  if (!caption) return "post";
  const clean = caption.replace(/#\S+/g, "").trim();
  if (clean.length <= maxLen) return clean || "post";
  return clean.slice(0, maxLen).trim() + "...";
}

function mediaTypeName(type: MediaType | string): string {
  switch (type) {
    case "CAROUSEL_ALBUM": return "carousel";
    case "VIDEO": return "video";
    case "IMAGE": return "photo";
    default: return "post";
  }
}

function hoursSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

function isThisWeek(dateStr: string): boolean {
  const now = new Date();
  const d = new Date(dateStr);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return d >= startOfWeek;
}

function isLastWeek(dateStr: string): boolean {
  const now = new Date();
  const d = new Date(dateStr);
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  return d >= startOfLastWeek && d < startOfThisWeek;
}

// ── Analyzers ───────────────────────────────────────────

/**
 * 1. Top Performers — posts with engagement >2x above average
 */
const topPerformers: Analyzer = ({ media }) => {
  if (media.length < MIN_POSTS_FOR_ANALYSIS) return [];

  const cards: InsightCard[] = [];
  const avgEng = avg(media.map(totalEngagement));
  if (avgEng === 0) return [];

  const stars = media
    .filter((m) => totalEngagement(m) > avgEng * ENGAGEMENT_MULTIPLIER_THRESHOLD)
    .sort((a, b) => totalEngagement(b) - totalEngagement(a))
    .slice(0, 2); // max 2 cards

  for (const m of stars) {
    const multiplier = (totalEngagement(m) / avgEng).toFixed(1);
    cards.push({
      id: `top-post-${m.instagram_id}`,
      priority: "act-now",
      category: "content",
      icon: "🔥",
      titleKey: "top-post.title",
      bodyKey: "top-post.body",
      vars: {
        description: captionPreview(m.caption),
        reach: String(m.reach ?? m.impressions ?? totalEngagement(m)),
        multiplier,
      },
      action: {
        labelKey: "top-post.action",
        href: m.permalink,
        type: "external",
      },
      dataPoints: [
        { label: "Likes", value: String(m.like_count) },
        { label: "Comments", value: String(m.comments_count) },
        { label: "Saves", value: String(m.saved ?? 0) },
        { label: "Reach", value: String(m.reach ?? "N/A") },
      ],
    });
  }
  return cards;
};

/**
 * 2. Best Content Type — carousel vs photo vs video comparison
 */
const bestContentType: Analyzer = ({ media }) => {
  if (media.length < MIN_POSTS_FOR_ANALYSIS) return [];

  const byType: Record<string, number[]> = {};
  for (const m of media) {
    const type = m.media_type;
    if (!byType[type]) byType[type] = [];
    byType[type].push(totalEngagement(m));
  }

  const types = Object.keys(byType);
  if (types.length < 2) return []; // need at least 2 types to compare

  const avgByType = types.map((t) => ({ type: t, avg: avg(byType[t]) }));
  avgByType.sort((a, b) => b.avg - a.avg);

  const winner = avgByType[0];
  const loser = avgByType[avgByType.length - 1];
  const multiplier = loser.avg > 0 ? (winner.avg / loser.avg).toFixed(1) : "2+";

  if (parseFloat(String(multiplier)) < 1.3) return []; // not significant enough

  return [{
    id: "best-content-type",
    priority: "worth-trying",
    category: "content",
    icon: "📸",
    titleKey: "best-content-type.title",
    bodyKey: "best-content-type.body",
    vars: {
      winner: mediaTypeName(winner.type),
      loser: mediaTypeName(loser.type),
      winnerLower: mediaTypeName(winner.type).toLowerCase(),
      multiplier: String(multiplier),
    },
    action: { labelKey: "best-content-type.action" },
    dataPoints: avgByType.map((t) => ({
      label: mediaTypeName(t.type),
      value: `avg ${Math.round(t.avg)} engagement`,
    })),
  }];
};

/**
 * 3. Saves Signal — high-save posts (saves = "I want this tattoo")
 */
const savesSignal: Analyzer = ({ media }) => {
  const withSaves = media
    .filter((m) => (m.saved ?? 0) >= MIN_SAVES_THRESHOLD)
    .sort((a, b) => (b.saved ?? 0) - (a.saved ?? 0))
    .slice(0, 2);

  if (withSaves.length === 0) return [];

  const medianSaves = median(media.map((m) => m.saved ?? 0));
  const cards: InsightCard[] = [];

  for (const m of withSaves) {
    const saves = m.saved ?? 0;
    // Also check if save ratio is exceptional
    const reach = m.reach ?? m.impressions ?? 0;
    const saveRate = reach > 0 ? ((saves / reach) * 100).toFixed(1) : null;

    if (saves > medianSaves * 2 || saves >= 10) {
      cards.push({
        id: `saves-signal-${m.instagram_id}`,
        priority: "act-now",
        category: "content",
        icon: "🔖",
        titleKey: saveRate && parseFloat(saveRate) > 3 ? "high-save-ratio.title" : "saves-signal.title",
        bodyKey: saveRate && parseFloat(saveRate) > 3 ? "high-save-ratio.body" : "saves-signal.body",
        vars: {
          count: String(saves),
          description: captionPreview(m.caption),
          rate: saveRate ?? "—",
        },
        action: {
          labelKey: "saves-signal.action",
          href: "/admin/portfolio",
          type: "internal",
        },
        dataPoints: [
          { label: "Saves", value: String(saves) },
          { label: "Save rate", value: saveRate ? `${saveRate}%` : "N/A" },
          { label: "Reach", value: String(reach || "N/A") },
        ],
      });
    }
  }
  return cards;
};

/**
 * 4. Best Day to Post
 */
const bestDay: Analyzer = ({ media }) => {
  if (media.length < MIN_POSTS_FOR_ANALYSIS * 2) return []; // need decent sample

  const byDay: Record<number, number[]> = {};
  for (const m of media) {
    const day = new Date(m.timestamp).getDay();
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(totalEngagement(m));
  }

  const days = Object.entries(byDay)
    .filter(([, vals]) => vals.length >= 2) // need at least 2 posts on that day
    .map(([day, vals]) => ({ day: parseInt(day), avg: avg(vals), count: vals.length }));

  if (days.length < 2) return [];

  days.sort((a, b) => b.avg - a.avg);
  const best = days[0];
  const overall = avg(media.map(totalEngagement));
  const multiplier = overall > 0 ? (best.avg / overall).toFixed(1) : "1";

  if (parseFloat(multiplier) < 1.2) return [];

  return [{
    id: "best-day",
    priority: "worth-trying",
    category: "timing",
    icon: "📅",
    titleKey: "best-day.title",
    bodyKey: "best-day.body",
    vars: {
      day: DAY_NAMES[best.day],
      multiplier,
    },
    dataPoints: days.slice(0, 4).map((d) => ({
      label: DAY_NAMES[d.day],
      value: `avg ${Math.round(d.avg)} eng (${d.count} posts)`,
    })),
  }];
};

/**
 * 5. Best Hour to Post
 */
const bestHour: Analyzer = ({ media }) => {
  if (media.length < MIN_POSTS_FOR_ANALYSIS * 2) return [];

  const byHour: Record<number, number[]> = {};
  for (const m of media) {
    const hour = new Date(m.timestamp).getHours();
    if (!byHour[hour]) byHour[hour] = [];
    byHour[hour].push(totalEngagement(m));
  }

  const hours = Object.entries(byHour)
    .filter(([, vals]) => vals.length >= 2)
    .map(([hour, vals]) => ({ hour: parseInt(hour), avg: avg(vals), count: vals.length }));

  if (hours.length < 2) return [];

  hours.sort((a, b) => b.avg - a.avg);
  const best = hours[0];
  const overall = avg(media.map(totalEngagement));
  const percent = overall > 0 ? Math.round(((best.avg - overall) / overall) * 100) : 0;

  if (percent < 15) return [];

  const timeStr = `${best.hour.toString().padStart(2, "0")}:00`;

  return [{
    id: "best-hour",
    priority: "worth-trying",
    category: "timing",
    icon: "⏰",
    titleKey: "best-hour.title",
    bodyKey: "best-hour.body",
    vars: {
      time: timeStr,
      percent: String(percent),
    },
    dataPoints: hours.slice(0, 4).map((h) => ({
      label: `${h.hour.toString().padStart(2, "0")}:00`,
      value: `avg ${Math.round(h.avg)} eng (${h.count} posts)`,
    })),
  }];
};

/**
 * 6. Posting Frequency — gap detection or consistency praise
 */
const postingFrequency: Analyzer = ({ media }) => {
  if (media.length === 0) return [];

  const sorted = [...media].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const latestPost = sorted[0];
  const daysSinceLatest = hoursSince(latestPost.timestamp) / 24;

  // Gap warning
  if (daysSinceLatest >= POSTING_GAP_WARN_DAYS) {
    return [{
      id: "posting-gap",
      priority: "act-now",
      category: "timing",
      icon: "⚡",
      titleKey: "posting-gap.title",
      bodyKey: "posting-gap.body",
      vars: { days: Math.floor(daysSinceLatest).toString() },
      action: {
        labelKey: "posting-gap.action",
        href: "https://instagram.com",
        type: "external",
      },
    }];
  }

  // Consistency praise — count posts in last 14 days
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentCount = sorted.filter((m) => new Date(m.timestamp) >= twoWeeksAgo).length;

  if (recentCount >= 3) {
    return [{
      id: "consistent-posting",
      priority: "good-to-know",
      category: "timing",
      icon: "💪",
      titleKey: "consistent-posting.title",
      bodyKey: "consistent-posting.body",
      vars: { count: String(recentCount), period: "14" },
    }];
  }

  return [];
};

/**
 * 7. Post → Booking Spike — bookings within 72h of a post
 */
const postDroveBookings: Analyzer = ({ media, bookings }) => {
  if (media.length === 0 || bookings.length === 0) return [];

  const cards: InsightCard[] = [];

  for (const m of media) {
    const postTime = new Date(m.timestamp).getTime();
    const windowEnd = postTime + BOOKING_CORRELATION_WINDOW_H * 60 * 60 * 1000;

    const correlated = bookings.filter((b) => {
      const bookTime = new Date(b.created_at).getTime();
      return bookTime >= postTime && bookTime <= windowEnd;
    });

    if (correlated.length >= 2) {
      cards.push({
        id: `post-bookings-${m.instagram_id}`,
        priority: "act-now",
        category: "booking",
        icon: "📈",
        titleKey: "post-drove-bookings.title",
        bodyKey: "post-drove-bookings.body",
        vars: {
          count: String(correlated.length),
          hours: String(BOOKING_CORRELATION_WINDOW_H),
          description: captionPreview(m.caption),
        },
        action: {
          labelKey: "post-drove-bookings.action",
          href: "/admin",
          type: "internal",
        },
        dataPoints: [
          { label: "Bookings", value: String(correlated.length) },
          { label: "Post date", value: new Date(m.timestamp).toLocaleDateString() },
          { label: "Types", value: [...new Set(correlated.map((b) => b.type))].join(", ") },
        ],
      });
    }
  }

  // Only return top 2
  return cards.slice(0, 2);
};

/**
 * 8. Content Type → Booking Conversion
 */
const contentTypeBookings: Analyzer = ({ media, bookings }) => {
  if (media.length < MIN_POSTS_FOR_ANALYSIS || bookings.length < 3) return [];

  const bookingsByType: Record<string, number> = {};
  let totalCorrelated = 0;

  for (const m of media) {
    const postTime = new Date(m.timestamp).getTime();
    const windowEnd = postTime + BOOKING_CORRELATION_WINDOW_H * 60 * 60 * 1000;

    const count = bookings.filter((b) => {
      const bookTime = new Date(b.created_at).getTime();
      return bookTime >= postTime && bookTime <= windowEnd;
    }).length;

    if (count > 0) {
      const type = m.media_type;
      bookingsByType[type] = (bookingsByType[type] ?? 0) + count;
      totalCorrelated += count;
    }
  }

  if (totalCorrelated < 3) return [];

  const types = Object.entries(bookingsByType).sort((a, b) => b[1] - a[1]);
  const [topType, topCount] = types[0];
  const percent = Math.round((topCount / totalCorrelated) * 100);

  if (percent < 50 || types.length < 2) return [];

  return [{
    id: "content-type-bookings",
    priority: "worth-trying",
    category: "booking",
    icon: "🎯",
    titleKey: "content-type-bookings.title",
    bodyKey: "content-type-bookings.body",
    vars: {
      type: mediaTypeName(topType),
      percent: String(percent),
    },
    dataPoints: types.map(([type, count]) => ({
      label: mediaTypeName(type),
      value: `${count} bookings (${Math.round((count / totalCorrelated) * 100)}%)`,
    })),
  }];
};

/**
 * 9. Booking Trend — this week vs last week
 */
const bookingTrend: Analyzer = ({ bookings }) => {
  const thisWeek = bookings.filter((b) => isThisWeek(b.created_at)).length;
  const lastWeek = bookings.filter((b) => isLastWeek(b.created_at)).length;

  if (thisWeek === 0 && lastWeek === 0) {
    // No bookings at all recently
    if (bookings.length > 0) {
      return [{
        id: "no-recent-bookings",
        priority: "act-now",
        category: "booking",
        icon: "📭",
        titleKey: "no-recent-bookings.title",
        bodyKey: "no-recent-bookings.body",
        vars: {},
      }];
    }
    return [];
  }

  // Trend up
  if (thisWeek > lastWeek && lastWeek > 0) {
    const percent = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    if (percent >= 20) {
      return [{
        id: "booking-trend-up",
        priority: "good-to-know",
        category: "booking",
        icon: "📈",
        titleKey: "booking-trend-up.title",
        bodyKey: "booking-trend-up.body",
        vars: {
          percent: String(percent),
          thisWeek: String(thisWeek),
          lastWeek: String(lastWeek),
        },
      }];
    }
  }

  // Trend down
  if (thisWeek < lastWeek && lastWeek > 0) {
    return [{
      id: "booking-trend-down",
      priority: "act-now",
      category: "booking",
      icon: "📉",
      titleKey: "booking-trend-down.title",
      bodyKey: "booking-trend-down.body",
      vars: {
        thisWeek: String(thisWeek),
        lastWeek: String(lastWeek),
      },
      action: {
        labelKey: "booking-trend-down.action",
        href: "https://instagram.com",
        type: "external",
      },
    }];
  }

  return [];
};

/**
 * 10. Portfolio Gap — high-save posts not in portfolio
 */
const portfolioGap: Analyzer = ({ media, portfolio }) => {
  if (media.length === 0) return [];

  // Simple heuristic: posts with high saves that might not be bookable
  // We can't do image matching, so we flag high-save posts and let Lia decide
  const medianSave = median(media.filter((m) => m.saved != null).map((m) => m.saved!));
  const threshold = Math.max(medianSave * 1.5, MIN_SAVES_THRESHOLD);
  const portfolioCount = portfolio.filter((p) => p.is_visible).length;

  const highSavePosts = media
    .filter((m) => (m.saved ?? 0) >= threshold)
    .sort((a, b) => (b.saved ?? 0) - (a.saved ?? 0));

  if (highSavePosts.length === 0 || portfolioCount === 0) return [];

  // Only show this if there's a meaningful gap (more popular posts than portfolio items)
  // Take top 1-2 that are clearly popular
  const cards: InsightCard[] = [];
  for (const m of highSavePosts.slice(0, 2)) {
    cards.push({
      id: `portfolio-gap-${m.instagram_id}`,
      priority: "act-now",
      category: "portfolio",
      icon: "🖼️",
      titleKey: "portfolio-gap.title",
      bodyKey: "portfolio-gap.body",
      vars: {
        description: captionPreview(m.caption),
        saves: String(m.saved ?? 0),
      },
      action: {
        labelKey: "portfolio-gap.action",
        href: "/admin/portfolio",
        type: "internal",
      },
      dataPoints: [
        { label: "Saves", value: String(m.saved ?? 0) },
        { label: "Likes", value: String(m.like_count) },
        { label: "Portfolio items", value: String(portfolioCount) },
      ],
    });
  }
  return cards;
};

/**
 * 11. Facebook Page suggestion — one-time
 */
const createFBPage: Analyzer = () => {
  // Always suggest — the UI can remember dismissal in localStorage
  return [{
    id: "create-fb-page",
    priority: "good-to-know",
    category: "growth",
    icon: "📘",
    titleKey: "create-fb-page.title",
    bodyKey: "create-fb-page.body",
    vars: {},
    action: {
      labelKey: "create-fb-page.action",
      href: "https://www.facebook.com/pages/creation/",
      type: "external",
    },
  }];
};

/**
 * 12. Google Business suggestion — one-time
 */
const googlePresence: Analyzer = () => {
  return [{
    id: "google-presence",
    priority: "good-to-know",
    category: "growth",
    icon: "📍",
    titleKey: "google-presence.title",
    bodyKey: "google-presence.body",
    vars: {},
  }];
};

/**
 * 13. Comments Engagement — high-comment posts
 */
const commentsEngagement: Analyzer = ({ media }) => {
  if (media.length < MIN_POSTS_FOR_ANALYSIS) return [];

  const avgComments = avg(media.map((m) => m.comments_count));
  if (avgComments === 0) return [];

  const talkative = media
    .filter((m) => m.comments_count > avgComments * ENGAGEMENT_MULTIPLIER_THRESHOLD)
    .sort((a, b) => b.comments_count - a.comments_count)
    .slice(0, 1);

  if (talkative.length === 0) return [];

  const m = talkative[0];
  return [{
    id: `comments-${m.instagram_id}`,
    priority: "good-to-know",
    category: "content",
    icon: "💬",
    titleKey: "comments-engagement.title",
    bodyKey: "comments-engagement.body",
    vars: {
      description: captionPreview(m.caption),
      comments: String(m.comments_count),
      multiplier: (m.comments_count / avgComments).toFixed(1),
    },
    dataPoints: [
      { label: "Comments", value: String(m.comments_count) },
      { label: "Avg comments", value: String(Math.round(avgComments)) },
    ],
  }];
};

/**
 * 14. Low Engagement Tip — high likes but low comments
 */
const lowEngagementTip: Analyzer = ({ media }) => {
  if (media.length < MIN_POSTS_FOR_ANALYSIS) return [];

  const avgLikes = avg(media.map((m) => m.like_count));
  const avgComments = avg(media.map((m) => m.comments_count));

  // If likes are healthy but comments are low
  if (avgLikes > 10 && avgComments < avgLikes * 0.03) {
    return [{
      id: "low-engagement-tip",
      priority: "good-to-know",
      category: "content",
      icon: "💡",
      titleKey: "low-engagement-tip.title",
      bodyKey: "low-engagement-tip.body",
      vars: {},
    }];
  }
  return [];
};

// ── All analyzers ───────────────────────────────────────

const ALL_ANALYZERS: Analyzer[] = [
  topPerformers,
  bestContentType,
  savesSignal,
  bestDay,
  bestHour,
  postingFrequency,
  postDroveBookings,
  contentTypeBookings,
  bookingTrend,
  portfolioGap,
  createFBPage,
  googlePresence,
  commentsEngagement,
  lowEngagementTip,
];

// ── Priority sort order ─────────────────────────────────

const PRIORITY_ORDER: Record<InsightPriority, number> = {
  "act-now": 0,
  "worth-trying": 1,
  "good-to-know": 2,
};

// ── Main engine ─────────────────────────────────────────

/**
 * Generate all insights from the given data.
 * Pure function — no side effects, no DB calls.
 */
export function generateInsights(input: AnalyzerInput): InsightsResponse {
  const { media, bookings, portfolio } = input;

  // Run all analyzers and collect cards
  const allCards: InsightCard[] = [];
  for (const analyzer of ALL_ANALYZERS) {
    try {
      const cards = analyzer(input);
      allCards.push(...cards);
    } catch (err) {
      // Don't let one broken analyzer kill everything
      console.error("Insight analyzer error:", err);
    }
  }

  // Sort by priority, then by category relevance
  allCards.sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pDiff !== 0) return pDiff;
    // Within same priority, booking > content > timing > portfolio > growth
    const catOrder: Record<string, number> = {
      booking: 0, content: 1, timing: 2, portfolio: 3, growth: 4,
    };
    return (catOrder[a.category] ?? 5) - (catOrder[b.category] ?? 5);
  });

  // Build summary
  const bookingsThisWeek = bookings.filter((b) => isThisWeek(b.created_at)).length;
  const bookingsLastWeek = bookings.filter((b) => isLastWeek(b.created_at)).length;
  const rates = media
    .filter((m) => (m.reach ?? m.impressions ?? 0) > 0)
    .map(engagementRate);
  const avgRate = rates.length > 0 ? avg(rates) : 0;

  return {
    insights: allCards,
    summary: {
      totalPosts: media.length,
      totalBookings: bookings.length,
      portfolioCount: portfolio.filter((p) => p.is_visible).length,
      avgEngagementRate: (avgRate * 100).toFixed(1) + "%",
      bookingsThisWeek,
      bookingsLastWeek,
    },
    generatedAt: new Date().toISOString(),
  };
}
