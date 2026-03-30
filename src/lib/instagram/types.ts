/**
 * Instagram Graph API type definitions.
 *
 * These match the Instagram Graph API v21.0 response shapes.
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api
 */

// ── Profile ─────────────────────────────────────────────

export type InstagramProfile = {
  id: string;
  username: string;
  name: string;
  biography: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  profile_picture_url: string;
  website: string;
};

// ── Media ───────────────────────────────────────────────

export type MediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";

export type InstagramMedia = {
  id: string;
  caption: string | null;
  media_type: MediaType;
  media_url: string;
  thumbnail_url: string | null; // only for VIDEO
  permalink: string;
  timestamp: string; // ISO 8601
  like_count: number;
  comments_count: number;
};

// ── Insights (per-media) ────────────────────────────────

export type MediaInsightName =
  | "impressions"
  | "reach"
  | "engagement"
  | "saved"
  | "video_views"
  | "shares";

export type MediaInsight = {
  name: MediaInsightName;
  period: "lifetime";
  values: [{ value: number }];
  title: string;
  description: string;
  id: string;
};

// ── Account Insights ────────────────────────────────────

export type AccountInsightName =
  | "impressions"
  | "reach"
  | "follower_count"
  | "profile_views";

export type AccountInsightPeriod = "day" | "week" | "days_28";

export type AccountInsightValue = {
  value: number;
  end_time: string; // ISO 8601
};

export type AccountInsight = {
  name: AccountInsightName;
  period: AccountInsightPeriod;
  values: AccountInsightValue[];
  title: string;
  description: string;
  id: string;
};

// ── API Responses ───────────────────────────────────────

export type PaginatedResponse<T> = {
  data: T[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
    previous?: string;
  };
};

export type InsightsResponse = {
  data: MediaInsight[];
};

export type AccountInsightsResponse = {
  data: AccountInsight[];
};

// ── Cached data shapes (for Supabase) ───────────────────

export type CachedMediaRow = {
  id: string;
  instagram_id: string;
  media_type: MediaType;
  caption: string | null;
  permalink: string;
  media_url: string;
  thumbnail_url: string | null;
  timestamp: string;
  like_count: number;
  comments_count: number;
  impressions: number | null;
  reach: number | null;
  engagement: number | null;
  saved: number | null;
  shares: number | null;
  fetched_at: string;
};

export type CachedMediaInsert = Omit<CachedMediaRow, "id" | "fetched_at">;

export type InstagramTokenRow = {
  id: string;
  access_token: string;
  token_type: "long_lived";
  expires_at: string;
  instagram_user_id: string;
  updated_at: string;
};
