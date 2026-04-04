import type { Locale } from "@/i18n/routing";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  SiteContentKey,
  SiteContentRow,
} from "@/lib/supabase/database.types";

export type SiteContentMap = Partial<Record<SiteContentKey, SiteContentRow>>;

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
