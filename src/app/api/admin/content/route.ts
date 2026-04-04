import { revalidatePath } from "next/cache";
import { getSupabaseUrl } from "@/lib/supabase/config";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  SiteContentInsert,
  SiteContentKey,
  SiteContentKind,
} from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

async function requireAuth() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim();
}

function getNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed = getString(value);
  return parsed === null ? null : parsed;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function isContentKind(value: unknown): value is SiteContentKind {
  return ["text", "textarea"].includes(String(value));
}

function isSiteContentKey(value: unknown): value is SiteContentKey {
  return [
    "booking_italy_note",
    "about_italy_note",
    "about_bio",
    "about_studios_note",
    "about_travel_note",
    "home_quote",
    "home_quote_highlight",
    "home_booking_cta_subtitle",
  ].includes(String(value));
}

export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const supabaseUrl = getSupabaseUrl();
    const [contentResult, featuredResult] = await Promise.all([
      admin.from("site_content").select("*").order("key", { ascending: true }),
      admin
        .from("portfolio_images")
        .select("id, title, category, storage_path, display_order, is_visible, featured_on_homepage")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false }),
    ]);

    if (contentResult.error) throw contentResult.error;
    if (featuredResult.error) throw featuredResult.error;

    return Response.json({
      content: contentResult.data ?? [],
      portfolio:
        featuredResult.data?.map((image) => ({
          ...image,
          url: `${supabaseUrl}/storage/v1/object/public/portfolio/${image.storage_path}`,
        })) ?? [],
    });
  } catch (error) {
    console.error("Site content fetch error:", error);
    return Response.json({ error: "Failed to load site content" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      content?: Array<Record<string, unknown>>;
      homepage_featured_ids?: unknown;
    };

    const admin = createAdminClient();

    if (Array.isArray(body.content)) {
      for (const entry of body.content) {
        if (!isSiteContentKey(entry.key)) {
          return Response.json({ error: `Invalid content key: ${String(entry.key)}` }, { status: 400 });
        }

        const payload: SiteContentInsert = {
          key: entry.key,
          source_en: "",
        };

        if (getNullableString(entry.title) !== null) payload.title = getNullableString(entry.title);
        if (getNullableString(entry.description) !== null) payload.description = getNullableString(entry.description);

        const sourceEn = getString(entry.source_en);
        if (sourceEn === null) {
          return Response.json({ error: `English source is required for ${entry.key}` }, { status: 400 });
        }
        payload.source_en = sourceEn;

        payload.it_override = getNullableString(entry.it_override);
        payload.sv_override = getNullableString(entry.sv_override);
        payload.da_override = getNullableString(entry.da_override);

        if (isContentKind(entry.content_kind)) {
          payload.content_kind = entry.content_kind;
        }

        const isActive = getBoolean(entry.is_active);
        if (isActive !== null) {
          payload.is_active = isActive;
        }

        const { error } = await admin.from("site_content").upsert(payload, { onConflict: "key" });
        if (error) {
          console.error("Site content upsert error:", error);
          return Response.json({ error: "Failed to save site content" }, { status: 500 });
        }
      }
    }

    if (Array.isArray(body.homepage_featured_ids)) {
      const featuredIds = body.homepage_featured_ids.filter((value): value is string => typeof value === "string");

      const { error: resetError } = await admin
        .from("portfolio_images")
        .update({ featured_on_homepage: false })
        .eq("featured_on_homepage", true);

      if (resetError) {
        console.error("Homepage feature reset error:", resetError);
        return Response.json({ error: "Failed to reset homepage features" }, { status: 500 });
      }

      if (featuredIds.length > 0) {
        const { error: featureError } = await admin
          .from("portfolio_images")
          .update({ featured_on_homepage: true })
          .in("id", featuredIds);

        if (featureError) {
          console.error("Homepage feature update error:", featureError);
          return Response.json({ error: "Failed to update homepage features" }, { status: 500 });
        }
      }
    }

    revalidatePath("/[locale]", "page");
    revalidatePath("/[locale]/about", "page");
    revalidatePath("/[locale]/booking", "page");
    revalidatePath("/[locale]/portfolio", "page");

    return Response.json({ success: true });
  } catch (error) {
    console.error("Site content save error:", error);
    return Response.json({ error: "Failed to save site content" }, { status: 500 });
  }
}
