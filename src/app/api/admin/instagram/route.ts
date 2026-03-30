import { NextRequest } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import {
  getConnectionStatus,
  getCachedMedia,
  refreshMediaCache,
  getCachedProfile,
  exchangeForLongLivedToken,
  generateInsights,
} from "@/lib/instagram";
import type { BookingRow, PortfolioImageRow } from "@/lib/supabase/database.types";

/** Verify the caller is authenticated */
async function requireAuth() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

/**
 * GET /api/admin/instagram — Get Instagram insights data
 *
 * Query params:
 *   - action: "status" | "media" | "profile" | "refresh"
 *   - limit: number (for media, default 25)
 */
export async function GET(request: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "status";

  try {
    switch (action) {
      case "status": {
        const status = await getConnectionStatus();
        return Response.json({ status });
      }

      case "media": {
        const limit = parseInt(searchParams.get("limit") ?? "25", 10);
        const media = await getCachedMedia(limit);
        return Response.json({ media });
      }

      case "profile": {
        const profile = await getCachedProfile();
        if (!profile) {
          return Response.json(
            { error: "Instagram not connected" },
            { status: 404 },
          );
        }
        return Response.json({ profile });
      }

      case "refresh": {
        const limit = parseInt(searchParams.get("limit") ?? "25", 10);
        const media = await refreshMediaCache(limit);
        return Response.json({ media, refreshed: true });
      }

      case "insights": {
        const limit = parseInt(searchParams.get("limit") ?? "50", 10);
        const media = await getCachedMedia(limit);

        // Fetch bookings and portfolio in parallel
        const admin = createAdminClient();
        const [bookingsResult, portfolioResult] = await Promise.all([
          admin
            .from("bookings")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(200),
          admin
            .from("portfolio_images")
            .select("*")
            .order("display_order", { ascending: true }),
        ]);

        const bookings = (bookingsResult.data as BookingRow[]) ?? [];
        const portfolio = (portfolioResult.data as PortfolioImageRow[]) ?? [];

        const result = generateInsights({ media, bookings, portfolio });
        return Response.json(result);
      }

      default:
        return Response.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error("Instagram API error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Instagram API error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/instagram — Setup / configure Instagram connection
 *
 * Body:
 *   - action: "setup" — Store initial token
 *   - shortLivedToken: string — The short-lived token from Meta Developer App
 *   - appSecret: string — The app secret from Meta Developer App
 *   - instagramUserId: string — Lia's Instagram user ID
 */
export async function POST(request: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.action === "setup") {
      const { shortLivedToken, appSecret, instagramUserId } = body;

      if (!shortLivedToken || !appSecret || !instagramUserId) {
        return Response.json(
          { error: "Missing required fields: shortLivedToken, appSecret, instagramUserId" },
          { status: 400 },
        );
      }

      // Exchange short-lived token for long-lived one
      const longLived = await exchangeForLongLivedToken(shortLivedToken, appSecret);

      const expiresAt = new Date(
        Date.now() + longLived.expires_in * 1000,
      ).toISOString();

      // Upsert token (only one row allowed)
      const admin = createAdminClient();
      const { error } = await admin
        .from("instagram_tokens")
        .upsert(
          {
            access_token: longLived.access_token,
            token_type: "long_lived",
            expires_at: expiresAt,
            instagram_user_id: instagramUserId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "token_type" },
        );

      if (error) {
        console.error("Token storage error:", error);
        return Response.json(
          { error: "Failed to store token" },
          { status: 500 },
        );
      }

      return Response.json({
        success: true,
        expiresAt,
        message: "Instagram connected! Token will auto-refresh before expiry.",
      });
    }

    return Response.json(
      { error: `Unknown action: ${body.action}` },
      { status: 400 },
    );
  } catch (err) {
    console.error("Instagram setup error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Setup failed" },
      { status: 500 },
    );
  }
}
