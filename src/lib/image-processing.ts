/**
 * Client-side image processing: HEIC conversion + compression.
 *
 * Handles iPhone HEIC photos and compresses all images to web-friendly sizes
 * before uploading to Supabase Storage.
 */
import imageCompression from "browser-image-compression";

const HEIC_TYPES = ["image/heic", "image/heif"];
const MAX_WIDTH = 1600; // px — sharp on retina, reasonable file size
const MAX_SIZE_MB = 1; // target compressed size
const QUALITY = 0.85;

/**
 * Check if a file is HEIC/HEIF format.
 * Also checks file extension since some browsers don't set HEIC MIME type correctly.
 */
function isHeicFile(file: File): boolean {
  if (HEIC_TYPES.includes(file.type.toLowerCase())) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "heic" || ext === "heif";
}

/**
 * Convert HEIC to JPEG using heic2any.
 * Dynamic import to keep bundle size down (heic2any is ~400KB).
 */
async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;

  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: QUALITY,
  });

  const blob = Array.isArray(result) ? result[0] : result;
  const newName = file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg");
  return new File([blob], newName, { type: "image/jpeg" });
}

/**
 * Compress and resize an image file.
 * Returns a web-optimized JPEG/PNG/WebP file.
 */
async function compressImage(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: MAX_WIDTH,
    useWebWorker: true,
    fileType: file.type === "image/png" ? "image/png" : "image/jpeg",
    initialQuality: QUALITY,
  });

  // imageCompression returns a Blob-like File, ensure it has the right name
  return new File([compressed], file.name, { type: compressed.type });
}

/**
 * Process a file for upload: convert HEIC if needed, then compress.
 *
 * @returns Processed file ready for upload + metadata
 */
export async function processImageForUpload(
  file: File,
  onProgress?: (status: string) => void
): Promise<{ file: File; wasConverted: boolean; originalSize: number; finalSize: number }> {
  const originalSize = file.size;
  let processed = file;
  let wasConverted = false;

  // Step 1: Convert HEIC to JPEG if needed
  if (isHeicFile(file)) {
    onProgress?.("Converting HEIC to JPEG...");
    processed = await convertHeicToJpeg(file);
    wasConverted = true;
  }

  // Step 2: Compress & resize
  // Skip compression for already-small files (< 500KB and reasonable dimensions)
  if (processed.size > 500 * 1024) {
    onProgress?.("Optimizing...");
    processed = await compressImage(processed);
  }

  return {
    file: processed,
    wasConverted,
    originalSize,
    finalSize: processed.size,
  };
}

/**
 * Format bytes to human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
