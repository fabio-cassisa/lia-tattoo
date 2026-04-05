import type { Locale } from "@/i18n/routing";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  SiteContentKind,
  SiteContentKey,
  SiteContentRow,
} from "@/lib/supabase/database.types";

export type SiteContentMap = Partial<Record<SiteContentKey, SiteContentRow>>;

type SiteContentDefinition = {
  title: string;
  description: string;
  source_en: string;
  content_kind: SiteContentKind;
  is_active?: boolean;
};

export const SITE_CONTENT_DEFINITIONS: Record<SiteContentKey, SiteContentDefinition> = {
  booking_italy_note: {
    title: "Booking Italy note",
    description: "Short helper note below the booking location selector.",
    source_en:
      "Planning something in Italy? Mention Friuli or Turin in your request, or reach out on Instagram and I'll guide you from there.",
    content_kind: "text",
  },
  about_italy_note: {
    title: "About Italy note",
    description: "Italy follow-up note on the public about page.",
    source_en:
      "If you're planning a tattoo in Italy, mention Friuli or Turin in your request or message me on Instagram so we can line it up properly.",
    content_kind: "text",
  },
  about_bio: {
    title: "About bio",
    description: "Main biography paragraph used on the homepage teaser and About page.",
    source_en:
      "Traditional tattoo artist based in Malmö, Sweden. Specializing in Old School tattoos - bold lines, rich colors, timeless designs.",
    content_kind: "textarea",
  },
  about_profile_image_url: {
    title: "About portrait image URL",
    description:
      "Public image URL or site-relative path for the portrait on the About page. Leave blank to hide the image.",
    source_en: "",
    content_kind: "text",
  },
  about_studios_note: {
    title: "About studios note",
    description: "Studio context paragraph on the About page.",
    source_en:
      "Working from Studio Diamant in Malmö, with selected dates at Good Morning Tattoo in Copenhagen.",
    content_kind: "textarea",
  },
  about_travel_note: {
    title: "About travel note",
    description: "Short travel note on the About page.",
    source_en:
      "Malmö is my main base. For Copenhagen dates and future travel announcements, check my Instagram.",
    content_kind: "textarea",
  },
  home_hero_title: {
    title: "Homepage hero title",
    description: "Main homepage headline. Keep this short because it sits above the fold.",
    source_en: "liagiorgi.one.ttt",
    content_kind: "text",
  },
  home_hero_subtitle: {
    title: "Homepage hero subtitle",
    description: "Small uppercase line under the homepage title.",
    source_en: "Malmö · Copenhagen based",
    content_kind: "text",
  },
  home_quote: {
    title: "Homepage quote intro",
    description: "First line of the homepage quote block.",
    source_en: "Bold lines, rich colors,",
    content_kind: "text",
  },
  home_quote_highlight: {
    title: "Homepage quote highlight",
    description: "Highlighted second line of the homepage quote block.",
    source_en: "timeless designs.",
    content_kind: "text",
  },
  home_booking_cta_subtitle: {
    title: "Homepage booking CTA subtitle",
    description: "Short subtitle for the homepage booking CTA block.",
    source_en: "Fill out the form and I'll get back to you soon.",
    content_kind: "text",
  },
};

export const SITE_CONTENT_KEYS = Object.keys(SITE_CONTENT_DEFINITIONS) as SiteContentKey[];

export function buildSiteContentEntry(
  key: SiteContentKey,
  row?: SiteContentRow
): SiteContentRow {
  const definition = SITE_CONTENT_DEFINITIONS[key];

  return {
    key,
    created_at: row?.created_at ?? "",
    updated_at: row?.updated_at ?? "",
    title: row?.title ?? definition.title,
    description: row?.description ?? definition.description,
    source_en: row?.source_en ?? definition.source_en,
    it_override: row?.it_override ?? null,
    sv_override: row?.sv_override ?? null,
    da_override: row?.da_override ?? null,
    content_kind: row?.content_kind ?? definition.content_kind,
    is_active: row?.is_active ?? definition.is_active ?? true,
  };
}

export async function getSiteContent(
  keys?: SiteContentKey[]
): Promise<SiteContentMap> {
  try {
    const admin = createAdminClient();
    let query = admin.from("site_content").select("*").eq("is_active", true);

    if (keys && keys.length > 0) {
      query = query.in("key", keys);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Site content fetch error:", error);
      return {};
    }

    return (data ?? []).reduce<SiteContentMap>((acc, item) => {
      acc[item.key as SiteContentKey] = item as SiteContentRow;
      return acc;
    }, {});
  } catch (error) {
    console.error("Site content fetch failed:", error);
    return {};
  }
}

export function resolveSiteContent(
  entry: SiteContentRow | undefined,
  locale: Locale,
  fallback: string
): string {
  if (!entry?.is_active) return fallback;

  if (locale === "it" && entry.it_override?.trim()) {
    return entry.it_override.trim();
  }

  if (locale === "sv" && entry.sv_override?.trim()) {
    return entry.sv_override.trim();
  }

  if (locale === "da" && entry.da_override?.trim()) {
    return entry.da_override.trim();
  }

  if (entry.source_en.trim()) {
    return entry.source_en.trim();
  }

  return fallback;
}
