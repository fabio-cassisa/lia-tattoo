import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_FILES = 5;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const bookingId = formData.get("booking_id") as string;
    const files = formData.getAll("files") as File[];

    // Validate booking ID
    if (!bookingId) {
      return Response.json(
        { error: "Missing booking_id" },
        { status: 400 }
      );
    }

    // Validate files
    if (!files.length) {
      return Response.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return Response.json(
        { error: `Maximum ${MAX_FILES} files allowed` },
        { status: 400 }
      );
    }

    const errors: string[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} exceeds 10MB limit`);
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name} has unsupported type: ${file.type}`);
      }
    }

    if (errors.length > 0) {
      return Response.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify booking exists
    const { data: booking } = await supabase
      .from("bookings")
      .select("id")
      .eq("id", bookingId)
      .single();

    if (!booking) {
      return Response.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // Upload each file to Supabase Storage and record in booking_images
    const uploaded: { file_name: string; storage_path: string }[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const storagePath = `${bookingId}/${crypto.randomUUID()}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("reference-images")
        .upload(storagePath, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        continue; // Skip this file but try the rest
      }

      // Record in booking_images table
      const { error: dbError } = await supabase
        .from("booking_images")
        .insert({
          booking_id: bookingId,
          storage_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        });

      if (dbError) {
        console.error("DB insert error for image:", dbError);
        continue;
      }

      uploaded.push({ file_name: file.name, storage_path: storagePath });
    }

    return Response.json(
      {
        message: `${uploaded.length} of ${files.length} images uploaded`,
        uploaded,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Image upload error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
