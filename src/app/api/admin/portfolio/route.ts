import { NextRequest } from "next/server";
import { getSupabaseUrl } from "@/lib/supabase/config";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import type { PortfolioCategory } from "@/lib/supabase/database.types";

/** Verify the caller is authenticated */
async function requireAuth() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

/**
 * GET /api/admin/portfolio — List ALL portfolio images (including hidden)
 */
export async function GET() {
  const user = await requireAuth();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portfolio_images")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin portfolio fetch error:", error);
    return Response.json({ error: "Failed to fetch portfolio" }, { status: 500 });
  }

  const supabaseUrl = getSupabaseUrl();
  const images = (data ?? []).map((img) => ({
    ...img,
    url: `${supabaseUrl}/storage/v1/object/public/portfolio/${img.storage_path}`,
  }));

  return Response.json({ images });
}

/**
 * POST /api/admin/portfolio — Upload portfolio image(s)
 *
 * Multipart form data:
 *   - file: image file (required)
 *   - category: "flash" | "completed" (default: "flash")
 *   - title: optional string
 */
export async function POST(request: NextRequest) {
  const user = await requireAuth();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as PortfolioCategory) || "flash";
    const title = formData.get("title") as string | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type (HEIC is converted client-side but accept it server-side too as fallback)
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    const isHeicByExt = ext === "heic" || ext === "heif";
    if (!allowedTypes.includes(file.type) && !isHeicByExt) {
      return Response.json(
        { error: "Invalid file type. Use JPEG, PNG, WebP, or HEIC." },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Generate unique storage path — normalize HEIC extensions to jpg
    const rawExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const storageExt = (rawExt === "heic" || rawExt === "heif") ? "jpg" : rawExt;
    const timestamp = Date.now();
    const storagePath = `${category}/${timestamp}-${Math.random().toString(36).slice(2, 8)}.${storageExt}`;

    // Upload to storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("portfolio")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Portfolio upload error:", uploadError);
      return Response.json({ error: "Upload failed" }, { status: 500 });
    }

    // Get next display order
    const { data: lastImage } = await admin
      .from("portfolio_images")
      .select("display_order")
      .eq("category", category)
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (lastImage?.display_order ?? -1) + 1;

    // Insert DB record
    const { data: record, error: dbError } = await admin
      .from("portfolio_images")
      .insert({
        title: title || null,
        category,
        storage_path: storagePath,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Portfolio DB insert error:", dbError);
      // Try to clean up uploaded file
      await admin.storage.from("portfolio").remove([storagePath]);
      return Response.json({ error: "Failed to save image record" }, { status: 500 });
    }

    const supabaseUrl = getSupabaseUrl();
    return Response.json({
      message: "Image uploaded",
      image: {
        ...record,
        url: `${supabaseUrl}/storage/v1/object/public/portfolio/${record.storage_path}`,
      },
    });
  } catch (err) {
    console.error("Portfolio upload error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/portfolio — Update portfolio image metadata
 *
 * Body: { id, title?, category?, display_order?, is_visible? }
 */
export async function PATCH(request: NextRequest) {
  const user = await requireAuth();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return Response.json({ error: "Image ID is required" }, { status: 400 });
    }

    // Only allow specific fields
    const allowed: Record<string, unknown> = {};
    if ("title" in updates) allowed.title = updates.title;
    if ("category" in updates) allowed.category = updates.category;
    if ("display_order" in updates) allowed.display_order = updates.display_order;
    if ("is_visible" in updates) allowed.is_visible = updates.is_visible;

    if (Object.keys(allowed).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("portfolio_images")
      .update(allowed)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Portfolio update error:", error);
      return Response.json({ error: "Failed to update image" }, { status: 500 });
    }

    const supabaseUrl = getSupabaseUrl();
    return Response.json({
      message: "Image updated",
      image: {
        ...data,
        url: `${supabaseUrl}/storage/v1/object/public/portfolio/${data.storage_path}`,
      },
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/portfolio — Delete a portfolio image
 *
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  const user = await requireAuth();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return Response.json({ error: "Image ID is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch the record to get storage path
    const { data: record } = await admin
      .from("portfolio_images")
      .select("storage_path")
      .eq("id", id)
      .single();

    if (!record) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await admin.storage
      .from("portfolio")
      .remove([record.storage_path]);

    if (storageError) {
      console.error("Portfolio storage delete error:", storageError);
      // Continue anyway — delete the DB record even if storage fails
    }

    // Delete DB record
    const { error: dbError } = await admin
      .from("portfolio_images")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error("Portfolio DB delete error:", dbError);
      return Response.json({ error: "Failed to delete image" }, { status: 500 });
    }

    return Response.json({ message: "Image deleted" });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
