"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { processImageForUpload, formatFileSize } from "@/lib/image-processing";

type PortfolioImage = {
  id: string;
  created_at: string;
  title: string | null;
  category: "flash" | "completed";
  storage_path: string;
  display_order: number;
  is_visible: boolean;
  url: string;
};

type UploadItem = {
  name: string;
  status: "processing" | "uploading" | "done" | "error";
  message: string;
  originalSize: number;
  finalSize?: number;
};

export default function AdminPortfolio() {
  const router = useRouter();
  const [images, setImages] = useState<PortfolioImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "flash" | "completed">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<"flash" | "completed">("flash");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState<"flash" | "completed">("flash");
  const [isDragOver, setIsDragOver] = useState(false);

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/portfolio");
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setImages(data.images);
      setError("");
    } catch {
      setError("Failed to load portfolio images");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  async function handleUpload(files: FileList | File[]) {
    setUploading(true);
    setError("");

    const fileArray = Array.from(files);
    const queue: UploadItem[] = fileArray.map((f) => ({
      name: f.name,
      status: "processing" as const,
      message: "Waiting...",
      originalSize: f.size,
    }));
    setUploadQueue(queue);

    const results: PortfolioImage[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];

      // Update queue: processing
      setUploadQueue((q) =>
        q.map((item, idx) =>
          idx === i ? { ...item, status: "processing", message: "Processing..." } : item
        )
      );

      try {
        // Process image (HEIC conversion + compression)
        const processed = await processImageForUpload(file, (status) => {
          setUploadQueue((q) =>
            q.map((item, idx) =>
              idx === i ? { ...item, message: status } : item
            )
          );
        });

        // Update queue: uploading
        setUploadQueue((q) =>
          q.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: "uploading",
                  message: `Uploading (${formatFileSize(processed.finalSize)})...`,
                  finalSize: processed.finalSize,
                }
              : item
          )
        );

        // Upload
        const formData = new FormData();
        formData.append("file", processed.file);
        formData.append("category", uploadCategory);

        const res = await fetch("/api/admin/portfolio", {
          method: "POST",
          body: formData,
        });

        if (res.status === 401) {
          router.push("/admin/login");
          return;
        }

        if (!res.ok) {
          const err = await res.json();
          setUploadQueue((q) =>
            q.map((item, idx) =>
              idx === i ? { ...item, status: "error", message: err.error || "Upload failed" } : item
            )
          );
          continue;
        }

        const data = await res.json();
        results.push(data.image);

        // Update queue: done
        const savedMsg = processed.wasConverted
          ? `Done (HEIC converted, ${formatFileSize(processed.originalSize)} -> ${formatFileSize(processed.finalSize)})`
          : processed.originalSize > processed.finalSize * 1.1
            ? `Done (${formatFileSize(processed.originalSize)} -> ${formatFileSize(processed.finalSize)})`
            : "Done";

        setUploadQueue((q) =>
          q.map((item, idx) =>
            idx === i ? { ...item, status: "done", message: savedMsg } : item
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Processing failed";
        setUploadQueue((q) =>
          q.map((item, idx) =>
            idx === i ? { ...item, status: "error", message } : item
          )
        );
      }
    }

    if (results.length > 0) {
      setImages((prev) => [...prev, ...results]);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Clear queue after a delay so user can see results
    setTimeout(() => setUploadQueue([]), 5000);
  }

  async function handleUpdate(id: string, updates: Record<string, unknown>) {
    try {
      const res = await fetch("/api/admin/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) throw new Error("Update failed");
      const data = await res.json();
      setImages((prev) => prev.map((img) => (img.id === id ? data.image : img)));
      setEditingId(null);
    } catch {
      setError("Failed to update image");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this image permanently?")) return;
    try {
      const res = await fetch("/api/admin/portfolio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) throw new Error("Delete failed");
      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch {
      setError("Failed to delete image");
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    const filtered = filteredImages;
    const idx = filtered.findIndex((img) => img.id === id);
    if (idx < 0) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= filtered.length) return;

    const current = filtered[idx];
    const swap = filtered[swapIdx];

    await Promise.all([
      handleUpdate(current.id, { display_order: swap.display_order }),
      handleUpdate(swap.id, { display_order: current.display_order }),
    ]);
    fetchImages();
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleUpload(files);
    }
  }

  const filteredImages =
    categoryFilter === "all"
      ? images
      : images.filter((img) => img.category === categoryFilter);

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-base sm:text-lg tracking-wider text-foreground">
            liagiorgi.one.ttt
          </h1>
          <p className="text-[10px] sm:text-xs text-foreground-muted tracking-wider uppercase">
            Portfolio Manager
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-foreground-muted hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-end"
        >
          Sign out
        </button>
      </div>

      {/* Admin nav */}
      <div className="flex gap-2 mb-6">
        <a
          href="/admin"
          className="px-3 py-1.5 text-xs rounded-full bg-[var(--sabbia-100)] text-foreground-muted hover:bg-[var(--sabbia-200)] transition-colors"
        >
          Bookings
        </a>
        <span className="px-3 py-1.5 text-xs rounded-full bg-[var(--ink-900)] text-[var(--sabbia-50)]">
          Portfolio
        </span>
        <a
          href="/admin/insights"
          className="px-3 py-1.5 text-xs rounded-full bg-[var(--sabbia-100)] text-foreground-muted hover:bg-[var(--sabbia-200)] transition-colors"
        >
          Creative Coach
        </a>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Upload section */}
      <div className="bg-white border border-[var(--sabbia-200)] rounded p-4 sm:p-5 mb-6">
        <p className="text-sm font-medium text-foreground mb-3">Upload images</p>

        {/* Category selector */}
        <div className="mb-3">
          <label className="block text-xs text-foreground-muted mb-1">Category</label>
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value as "flash" | "completed")}
            className="px-3 py-2 border border-[var(--sabbia-200)] rounded text-sm bg-white text-foreground"
            style={{ fontSize: "16px" }}
          >
            <option value="flash">Flash Designs</option>
            <option value="completed">Completed Work</option>
          </select>
        </div>

        {/* Drag & drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-colors ${
            isDragOver
              ? "border-[var(--trad-red-500)] bg-red-50/30"
              : "border-[var(--sabbia-300)] hover:border-[var(--ink-900)]/30 hover:bg-[var(--sabbia-50)]"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            multiple
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
            className="hidden"
            id="portfolio-upload"
          />

          <div className="flex flex-col items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground-muted">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <p className="text-sm text-foreground">
              {uploading ? "Processing..." : "Drop images here or tap to choose"}
            </p>
            <p className="text-xs text-foreground-muted">
              JPEG, PNG, WebP, or HEIC (iPhone photos) — auto-optimized before upload
            </p>
          </div>
        </div>

        {/* Upload progress queue */}
        {uploadQueue.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {uploadQueue.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 px-3 py-2 rounded text-xs ${
                  item.status === "done"
                    ? "bg-green-50 text-green-700"
                    : item.status === "error"
                      ? "bg-red-50 text-red-700"
                      : "bg-[var(--sabbia-50)] text-foreground-muted"
                }`}
              >
                {/* Status icon */}
                {item.status === "done" ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8l3.5 3.5L13 5" />
                  </svg>
                ) : item.status === "error" ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 2a6 6 0 015.5 8.5" />
                  </svg>
                )}

                <span className="truncate flex-1 font-medium">{item.name}</span>
                <span className="whitespace-nowrap">{item.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Upload specs */}
        <div className="mt-4 p-3 bg-[var(--sabbia-50)] border border-[var(--sabbia-200)] rounded text-xs text-foreground-muted space-y-1">
          <p className="font-medium text-foreground text-[11px] uppercase tracking-wider mb-1.5">Image specs</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            <p><span className="font-medium text-foreground">Formats:</span> JPEG, PNG, WebP, HEIC</p>
            <p><span className="font-medium text-foreground">Max file size:</span> 10 MB per image</p>
            <p><span className="font-medium text-foreground">Best size:</span> 1200 x 1200 px (square)</p>
            <p><span className="font-medium text-foreground">Min recommended:</span> 800 x 800 px</p>
            <p><span className="font-medium text-foreground">iPhone photos:</span> HEIC auto-converted to JPEG</p>
            <p><span className="font-medium text-foreground">Auto-optimization:</span> Large images resized & compressed</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "flash", "completed"] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
              categoryFilter === cat
                ? "bg-[var(--ink-900)] text-[var(--sabbia-50)]"
                : "bg-[var(--sabbia-100)] text-foreground-muted hover:bg-[var(--sabbia-200)]"
            }`}
          >
            {cat === "all" ? `All (${images.length})` : cat === "flash" ? `Flash (${images.filter(i => i.category === "flash").length})` : `Completed (${images.filter(i => i.category === "completed").length})`}
          </button>
        ))}
      </div>

      {/* Image grid */}
      {loading ? (
        <p className="text-sm text-foreground-muted py-8 text-center">Loading...</p>
      ) : filteredImages.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-foreground-muted">
            {images.length === 0 ? "No images yet — upload some above!" : "No images in this category."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredImages.map((img, idx) => (
            <div
              key={img.id}
              className={`relative group bg-white border rounded overflow-hidden ${
                !img.is_visible ? "opacity-50" : ""
              } ${editingId === img.id ? "border-[var(--trad-red-500)]" : "border-[var(--sabbia-200)]"}`}
            >
              {/* Image */}
              <div className="aspect-square relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.title || "Portfolio image"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Hidden badge */}
                {!img.is_visible && (
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] bg-gray-800 text-white rounded">
                    Hidden
                  </div>
                )}
                {/* Category badge */}
                <div className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] bg-black/60 text-white rounded">
                  {img.category === "flash" ? "Flash" : "Done"}
                </div>
              </div>

              {/* Controls — always visible on mobile, hover on desktop */}
              <div className="p-2 border-t border-[var(--sabbia-200)]">
                {editingId === img.id ? (
                  /* Edit mode */
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title (optional)"
                      className="w-full px-2 py-1 border border-[var(--sabbia-200)] rounded text-xs bg-white"
                      style={{ fontSize: "16px" }}
                    />
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as "flash" | "completed")}
                      className="w-full px-2 py-1 border border-[var(--sabbia-200)] rounded text-xs bg-white"
                      style={{ fontSize: "16px" }}
                    >
                      <option value="flash">Flash</option>
                      <option value="completed">Completed</option>
                    </select>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleUpdate(img.id, { title: editTitle || null, category: editCategory })}
                        className="flex-1 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 py-1 text-xs border border-[var(--sabbia-200)] text-foreground-muted rounded hover:bg-[var(--sabbia-100)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <div>
                    {img.title && (
                      <p className="text-xs text-foreground truncate mb-1">{img.title}</p>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      {/* Move buttons */}
                      <button
                        onClick={() => handleMove(img.id, "up")}
                        disabled={idx === 0}
                        className="px-1.5 py-0.5 text-[10px] border border-[var(--sabbia-200)] rounded text-foreground-muted hover:bg-[var(--sabbia-100)] disabled:opacity-30"
                        title="Move left"
                      >
                        &larr;
                      </button>
                      <button
                        onClick={() => handleMove(img.id, "down")}
                        disabled={idx === filteredImages.length - 1}
                        className="px-1.5 py-0.5 text-[10px] border border-[var(--sabbia-200)] rounded text-foreground-muted hover:bg-[var(--sabbia-100)] disabled:opacity-30"
                        title="Move right"
                      >
                        &rarr;
                      </button>
                      {/* Edit */}
                      <button
                        onClick={() => {
                          setEditingId(img.id);
                          setEditTitle(img.title || "");
                          setEditCategory(img.category);
                        }}
                        className="px-1.5 py-0.5 text-[10px] border border-[var(--sabbia-200)] rounded text-foreground-muted hover:bg-[var(--sabbia-100)]"
                      >
                        Edit
                      </button>
                      {/* Toggle visibility */}
                      <button
                        onClick={() => handleUpdate(img.id, { is_visible: !img.is_visible })}
                        className="px-1.5 py-0.5 text-[10px] border border-[var(--sabbia-200)] rounded text-foreground-muted hover:bg-[var(--sabbia-100)]"
                      >
                        {img.is_visible ? "Hide" : "Show"}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(img.id)}
                        className="px-1.5 py-0.5 text-[10px] border border-red-300 rounded text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
