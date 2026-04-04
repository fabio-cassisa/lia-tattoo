import { revalidatePath } from "next/cache";
import { getSupabaseUrl } from "@/lib/supabase/config";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildSiteContentEntry,
  SITE_CONTENT_DEFINITIONS,
  SITE_CONTENT_KEYS,
} from "@/lib/site-content";
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
  return SITE_CONTENT_KEYS.includes(String(value) as SiteContentKey);
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

    const contentRows = contentResult.data ?? [];
    const contentMap = new Map(contentRows.map((item) => [item.key as SiteContentKey, item]));
    const content = SITE_CONTENT_KEYS.map((key) => buildSiteContentEntry(key, contentMap.get(key)));

    return Response.json({
      content,
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
          source_en: SITE_CONTENT_DEFINITIONS[entry.key].source_en,
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

export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const target = formData.get("target");

    if (target !== "about_profile_image") {
      return Response.json({ error: "Invalid upload target" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    const isHeicByExt = ext === "heic" || ext === "heif";
    if (!allowedTypes.includes(file.type) && !isHeicByExt) {
      return Response.json(
        { error: "Invalid file type. Use JPEG, PNG, WebP, or HEIC." },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const rawExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const storageExt = rawExt === "heic" || rawExt === "heif" ? "jpg" : rawExt;
    const storagePath = `site-content/about/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${storageExt}`;

    const admin = createAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("portfolio")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Site content upload error:", uploadError);
      return Response.json({ error: "Upload failed" }, { status: 500 });
    }

    const supabaseUrl = getSupabaseUrl();
    return Response.json({
      url: `${supabaseUrl}/storage/v1/object/public/portfolio/${storagePath}`,
      storagePath,
    });
  } catch (error) {
    console.error("Site content upload failed:", error);
    return Response.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
