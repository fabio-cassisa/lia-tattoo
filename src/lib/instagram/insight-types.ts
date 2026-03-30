/**
 * Insight card types for the creative coach system.
 *
 * Each InsightCard is a single, actionable observation
 * that Lia can understand and act on without being data-savvy.
 */

export type InsightPriority = "act-now" | "worth-trying" | "good-to-know";

export type InsightCategory =
  | "content"    // what to post
  | "booking"    // content → booking correlation
  | "timing"     // when to post
  | "portfolio"  // portfolio gaps, availability
  | "growth";    // platform presence, reach expansion

export type InsightCard = {
  id: string;
  priority: InsightPriority;
  category: InsightCategory;
  icon: string;                 // emoji for the card
  titleKey: string;             // i18n key for title
  bodyKey: string;              // i18n key for body text
  vars: Record<string, string>; // interpolation variables for i18n
  action?: {
    labelKey: string;           // i18n key for action button
    href?: string;
    type?: "internal" | "external";
  };
  dataPoints?: {
    label: string;
    value: string;
  }[];
};

export type InsightLocale = "en" | "it" | "sv";

export type InsightsResponse = {
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
