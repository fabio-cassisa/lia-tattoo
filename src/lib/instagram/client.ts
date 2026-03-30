/**
 * Instagram Graph API client.
 *
 * Handles:
 * - Fetching profile info, media, and insights
 * - Long-lived token refresh
 * - Error handling with typed responses
 *
 * Setup required (Fabio does this in browser):
 * 1. Create Meta Developer App at https://developers.facebook.com
 * 2. Add Instagram Graph API product
 * 3. Connect Lia's Instagram Business/Creator account
 * 4. Generate long-lived token via token exchange
 * 5. Store token in Supabase via /api/admin/instagram/setup
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api
 */

import type {
  InstagramProfile,
  InstagramMedia,
  PaginatedResponse,
  InsightsResponse,
  AccountInsightsResponse,
  AccountInsightPeriod,
  MediaInsight,
} from "./types";

const API_BASE = "https://graph.instagram.com/v21.0";

// ── Error handling ──────────────────────────────────────

export class InstagramAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorType?: string,
    public errorSubcode?: number,
  ) {
    super(message);
    this.name = "InstagramAPIError";
  }
}

type GraphAPIError = {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
};

async function graphFetch<T>(url: string, token: string): Promise<T> {
  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}access_token=${token}`;

  const res = await fetch(fullUrl, {
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 0 }, // never cache API calls
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as GraphAPIError | null;
    throw new InstagramAPIError(
      body?.error?.message || `Instagram API error: ${res.status}`,
      res.status,
      body?.error?.type,
      body?.error?.error_subcode,
    );
  }

  return res.json() as Promise<T>;
}

// ── Token management ────────────────────────────────────

/**
 * Refresh a long-lived token. Long-lived tokens last 60 days.
 * Call this when the token is within 7 days of expiry.
 * Returns a new long-lived token.
 */
export async function refreshLongLivedToken(currentToken: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
}> {
  return graphFetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token`,
    currentToken,
  );
}

/**
 * Exchange a short-lived token for a long-lived one.
 * Short-lived tokens last 1 hour, long-lived last 60 days.
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  appSecret: string,
): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
}> {
  const url = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortLivedToken}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new InstagramAPIError(
      "Failed to exchange token",
      res.status,
    );
  }
  return res.json();
}

// ── Profile ─────────────────────────────────────────────

const PROFILE_FIELDS = [
  "id",
  "username",
  "name",
  "biography",
  "followers_count",
  "follows_count",
  "media_count",
  "profile_picture_url",
  "website",
].join(",");

export async function getProfile(
  token: string,
  userId: string = "me",
): Promise<InstagramProfile> {
  return graphFetch<InstagramProfile>(
    `${API_BASE}/${userId}?fields=${PROFILE_FIELDS}`,
    token,
  );
}

// ── Media ───────────────────────────────────────────────

const MEDIA_FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_url",
  "thumbnail_url",
  "permalink",
  "timestamp",
  "like_count",
  "comments_count",
].join(",");

/**
 * Fetch recent media. Returns up to `limit` items (max 100 per page).
 */
export async function getRecentMedia(
  token: string,
  userId: string = "me",
  limit: number = 25,
): Promise<InstagramMedia[]> {
  const response = await graphFetch<PaginatedResponse<InstagramMedia>>(
    `${API_BASE}/${userId}/media?fields=${MEDIA_FIELDS}&limit=${limit}`,
    token,
  );
  return response.data;
}

/**
 * Fetch all media with pagination (up to maxPages * pageSize).
 */
export async function getAllMedia(
  token: string,
  userId: string = "me",
  maxPages: number = 4,
  pageSize: number = 25,
): Promise<InstagramMedia[]> {
  const all: InstagramMedia[] = [];

  let url: string | undefined =
    `${API_BASE}/${userId}/media?fields=${MEDIA_FIELDS}&limit=${pageSize}`;

  for (let page = 0; page < maxPages && url; page++) {
    const response: PaginatedResponse<InstagramMedia> = await graphFetch<PaginatedResponse<InstagramMedia>>(
      url,
      token,
    );
    all.push(...response.data);
    url = response.paging?.next;
  }

  return all;
}

// ── Media Insights ──────────────────────────────────────

/**
 * Fetch insights for a single media item.
 * Note: Not available for stories older than 24h or for album children.
 */
export async function getMediaInsights(
  token: string,
  mediaId: string,
): Promise<MediaInsight[]> {
  const metrics = "impressions,reach,engagement,saved,shares";

  try {
    const response = await graphFetch<InsightsResponse>(
      `${API_BASE}/${mediaId}/insights?metric=${metrics}`,
      token,
    );
    return response.data;
  } catch (err) {
    // Some media types don't support insights — fail gracefully
    if (err instanceof InstagramAPIError && err.statusCode === 400) {
      return [];
    }
    throw err;
  }
}

// ── Account Insights ────────────────────────────────────

/**
 * Fetch account-level insights (impressions, reach, follower_count, profile_views).
 * Requires period and date range (max 30 days for "day" period).
 */
export async function getAccountInsights(
  token: string,
  userId: string = "me",
  metrics: string[] = ["impressions", "reach", "follower_count", "profile_views"],
  period: AccountInsightPeriod = "day",
  since?: Date,
  until?: Date,
): Promise<AccountInsightsResponse> {
  const sinceTs = since
    ? Math.floor(since.getTime() / 1000)
    : Math.floor((Date.now() - 28 * 24 * 60 * 60 * 1000) / 1000);
  const untilTs = until
    ? Math.floor(until.getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  return graphFetch<AccountInsightsResponse>(
    `${API_BASE}/${userId}/insights?metric=${metrics.join(",")}&period=${period}&since=${sinceTs}&until=${untilTs}`,
    token,
  );
}

// ── Convenience: Media + Insights combined ──────────────

export type MediaWithInsights = InstagramMedia & {
  insights: {
    impressions: number | null;
    reach: number | null;
    engagement: number | null;
    saved: number | null;
    shares: number | null;
  };
};

/**
 * Fetch recent media WITH insights in one go.
 * Makes 1 + N API calls (1 for media list, N for each media's insights).
 * Respect rate limits: 200 calls/user/hour.
 */
export async function getMediaWithInsights(
  token: string,
  userId: string = "me",
  limit: number = 25,
): Promise<MediaWithInsights[]> {
  const media = await getRecentMedia(token, userId, limit);

  const withInsights: MediaWithInsights[] = await Promise.all(
    media.map(async (item) => {
      const insights = await getMediaInsights(token, item.id);

      const insightsMap: MediaWithInsights["insights"] = {
        impressions: null,
        reach: null,
        engagement: null,
        saved: null,
        shares: null,
      };

      for (const insight of insights) {
        if (insight.name in insightsMap) {
          insightsMap[insight.name as keyof typeof insightsMap] =
            insight.values[0]?.value ?? null;
        }
      }

      return { ...item, insights: insightsMap };
    }),
  );

  return withInsights;
}
