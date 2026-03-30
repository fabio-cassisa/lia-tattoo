import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/portfolio — Public endpoint, returns visible portfolio images
 *
 * Query params:
 *   - category: "flash" | "completed" (optional filter)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const admin = createAdminClient();
  let query = admin
    .from("portfolio_images")
    .select("*")
    .eq("is_visible", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (category === "flash" || category === "completed") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Portfolio fetch error:", error);
    return Response.json({ error: "Failed to fetch portfolio" }, { status: 500 });
  }

  // Add public URLs for each image
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const images = (data ?? []).map((img) => ({
    ...img,
    url: `${supabaseUrl}/storage/v1/object/public/portfolio/${img.storage_path}`,
  }));

  return Response.json({ images });
}
