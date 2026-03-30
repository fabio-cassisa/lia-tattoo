/**
 * Instagram data cache — Supabase persistence layer.
 *
 * Caches media + insights to avoid hammering the Instagram API.
 * Cache TTL: 1 hour for media data, 6 hours for insights.
 *
 * Flow:
 * 1. Check cache age
 * 2. If fresh enough, return cached data
 * 3. If stale, fetch from Instagram API, update cache, return fresh data
 */

import { createAdminClient } from "@/lib/supabase/server";
import {
  getProfile,
  getMediaWithInsights,
  refreshLongLivedToken,
  type MediaWithInsights,
} from "./client";
import type {
  InstagramProfile,
  CachedMediaRow,
  InstagramTokenRow,
} from "./types";

const MEDIA_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const TOKEN_REFRESH_BUFFER_DAYS = 7; // refresh when < 7 days left

// ── Token management ────────────────────────────────────

/**
 * Get the stored Instagram access token, refreshing if near expiry.
 * Returns null if no token is configured.
 */
export async function getValidToken(): Promise<string | null> {
  const admin = createAdminClient();

  const { data: tokenRow, error } = await admin
    .from("instagram_tokens")
    .select("*")
    .single<InstagramTokenRow>();

  if (error || !tokenRow) {
    return null;
  }

  const expiresAt = new Date(tokenRow.expires_at);
  const refreshThreshold = new Date();
  refreshThreshold.setDate(refreshThreshold.getDate() + TOKEN_REFRESH_BUFFER_DAYS);

  // Token is still valid and not near expiry
  if (expiresAt > refreshThreshold) {
    return tokenRow.access_token;
  }

  // Token needs refresh
  try {
    const refreshed = await refreshLongLivedToken(tokenRow.access_token);

    const newExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000,
    ).toISOString();

    await admin
      .from("instagram_tokens")
      .update({
        access_token: refreshed.access_token,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenRow.id);

    return refreshed.access_token;
  } catch (err) {
    console.error("Instagram token refresh failed:", err);
    // Return current token — it might still work for a few more days
    if (expiresAt > new Date()) {
      return tokenRow.access_token;
    }
    return null;
  }
}

// ── Profile cache ───────────────────────────────────────

/**
 * Get cached profile or fetch fresh from API.
 */
export async function getCachedProfile(): Promise<InstagramProfile | null> {
  const token = await getValidToken();
  if (!token) return null;

  // Profile doesn't change often — could cache in Supabase,
  // but for now just fetch live (it's 1 API call)
  try {
    return await getProfile(token);
  } catch (err) {
    console.error("Instagram profile fetch failed:", err);
    return null;
  }
}

// ── Media cache ─────────────────────────────────────────

/**
 * Get cached media with insights.
 * Returns from Supabase cache if fresh, otherwise fetches from Instagram API.
 */
export async function getCachedMedia(
  limit: number = 25,
): Promise<CachedMediaRow[]> {
  const admin = createAdminClient();

  // Check cache freshness — look at the most recently fetched item
  const { data: latest } = await admin
    .from("instagram_media_cache")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single<{ fetched_at: string }>();

  const isFresh =
    latest &&
    Date.now() - new Date(latest.fetched_at).getTime() < MEDIA_CACHE_TTL_MS;

  if (isFresh) {
    const { data } = await admin
      .from("instagram_media_cache")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);

    return (data as CachedMediaRow[]) ?? [];
  }

  // Cache is stale — refresh from Instagram API
  return refreshMediaCache(limit);
}

/**
 * Force-refresh the media cache from Instagram API.
 */
export async function refreshMediaCache(
  limit: number = 25,
): Promise<CachedMediaRow[]> {
  const token = await getValidToken();
  if (!token) return [];

  try {
    const media = await getMediaWithInsights(token, "me", limit);
    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Upsert all media into cache
    const rows = media.map((item: MediaWithInsights) => ({
      instagram_id: item.id,
      media_type: item.media_type,
      caption: item.caption,
      permalink: item.permalink,
      media_url: item.media_url,
      thumbnail_url: item.thumbnail_url,
      timestamp: item.timestamp,
      like_count: item.like_count,
      comments_count: item.comments_count,
      impressions: item.insights.impressions,
      reach: item.insights.reach,
      engagement: item.insights.engagement,
      saved: item.insights.saved,
      shares: item.insights.shares,
      fetched_at: now,
    }));

    if (rows.length > 0) {
      const { error } = await admin
        .from("instagram_media_cache")
        .upsert(rows, { onConflict: "instagram_id" });

      if (error) {
        console.error("Instagram cache upsert error:", error);
      }
    }

    // Return the freshly cached data
    const { data } = await admin
      .from("instagram_media_cache")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);

    return (data as CachedMediaRow[]) ?? [];
  } catch (err) {
    console.error("Instagram media refresh failed:", err);

    // Fallback to stale cache
    const admin = createAdminClient();
    const { data } = await admin
      .from("instagram_media_cache")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);

    return (data as CachedMediaRow[]) ?? [];
  }
}

// ── Status check ────────────────────────────────────────

export type InstagramConnectionStatus =
  | { connected: false; reason: string }
  | {
      connected: true;
      username: string;
      tokenExpiresAt: string;
      cachedMediaCount: number;
      lastFetchedAt: string | null;
    };

/**
 * Check if Instagram is connected and return status info.
 */
export async function getConnectionStatus(): Promise<InstagramConnectionStatus> {
  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("instagram_tokens")
    .select("*")
    .single<InstagramTokenRow>();

  if (!tokenRow) {
    return {
      connected: false,
      reason: "No Instagram token configured. Set up the Meta Developer App and connect Lia's account.",
    };
  }

  const expiresAt = new Date(tokenRow.expires_at);
  if (expiresAt < new Date()) {
    return {
      connected: false,
      reason: "Instagram token has expired. Re-authenticate to get a new token.",
    };
  }

  // Get cache stats
  const { count } = await admin
    .from("instagram_media_cache")
    .select("*", { count: "exact", head: true });

  const { data: latest } = await admin
    .from("instagram_media_cache")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single<{ fetched_at: string }>();

  return {
    connected: true,
    username: tokenRow.instagram_user_id,
    tokenExpiresAt: tokenRow.expires_at,
    cachedMediaCount: count ?? 0,
    lastFetchedAt: latest?.fetched_at ?? null,
  };
}
