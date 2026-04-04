"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { processImageForUpload, formatFileSize } from "@/lib/image-processing";
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminShell,
  AdminSurface,
} from "@/components/admin/AdminShell";
import { AdminAlert, AdminButton, AdminSectionHeading } from "@/components/admin/AdminPrimitives";

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

const PORTFOLIO_FIELD_CLASSNAME =
  "w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground";
const PORTFOLIO_CARD_ACTION_CLASSNAME =
  "inline-flex min-h-[36px] items-center justify-center rounded-full border border-[var(--sabbia-200)] px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:bg-[var(--sabbia-100)] disabled:opacity-30";
const CATEGORY_LABELS = {
  all: "All",
  flash: "Flash",
  completed: "Completed",
} as const;

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
    setLoading(true);
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
  const visibleCount = images.filter((img) => img.is_visible).length;
  const flashCount = images.filter((img) => img.category === "flash").length;
  const completedCount = images.filter((img) => img.category === "completed").length;

  return (
    <AdminShell
      title="Portfolio"
      description="Upload, sort, and curate Lia’s work in one place so the public site stays fresh without turning admin into a chore."
      activeTab="portfolio"
      maxWidth="wide"
      actions={
        <>
          <AdminButton type="button" variant="secondary" onClick={fetchImages}>
            Refresh
          </AdminButton>
          <AdminButton
            type="button"
            variant="primary"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose images
          </AdminButton>
        </>
      }
    >
      <div className="space-y-6">
        {error ? (
          <AdminAlert>
            {error}
            <button onClick={() => setError("")} className="ml-2 underline">dismiss</button>
          </AdminAlert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard label="Total images" value={images.length} detail="Everything in the portfolio library" />
          <AdminMetricCard label="Visible" value={visibleCount} detail="Shown on the public site" tone={visibleCount > 0 ? "accent" : "default"} />
          <AdminMetricCard label="Flash" value={flashCount} detail="Bookable flash designs" />
          <AdminMetricCard label="Completed" value={completedCount} detail="Finished tattoo work" />
        </div>

        <AdminSurface>
          <AdminSectionHeading
            title="Upload images"
            description="Process, compress, and drop new work into the portfolio without having to think about file prep every single time."
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-start">
            <label className="text-sm text-foreground-muted">
              Upload category
              <select
                value={uploadCategory}
                onChange={(event) => setUploadCategory(event.target.value as "flash" | "completed")}
                className={`mt-1 min-h-[44px] ${PORTFOLIO_FIELD_CLASSNAME}`}
                style={{ fontSize: "16px" }}
              >
                <option value="flash">Flash designs</option>
                <option value="completed">Completed work</option>
              </select>
            </label>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-3xl border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
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
                onChange={(event) => event.target.files && handleUpload(event.target.files)}
                className="hidden"
                id="portfolio-upload"
              />

              <div className="flex flex-col items-center gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground-muted">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                <p className="text-sm font-medium text-foreground">
                  {uploading ? "Processing images..." : "Drop images here or tap to choose"}
                </p>
                <p className="max-w-md text-xs leading-relaxed text-foreground-muted">
                  JPEG, PNG, WebP, or HEIC. Large files are auto-optimized before upload so the public site stays fast.
                </p>
              </div>
            </div>
          </div>

          {uploadQueue.length > 0 ? (
            <div className="mt-4 space-y-2">
              {uploadQueue.map((item, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs ${
                    item.status === "done"
                      ? "bg-green-50 text-green-700"
                      : item.status === "error"
                        ? "bg-red-50 text-red-700"
                        : "bg-[var(--sabbia-50)] text-foreground-muted"
                  }`}
                >
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

                  <span className="flex-1 truncate font-medium">{item.name}</span>
                  <span className="whitespace-nowrap">{item.message}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4 text-xs text-foreground-muted">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-foreground">Image specs</p>
            <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <p><span className="font-medium text-foreground">Formats:</span> JPEG, PNG, WebP, HEIC</p>
              <p><span className="font-medium text-foreground">Max file size:</span> 10 MB per image</p>
              <p><span className="font-medium text-foreground">Best size:</span> 1200 x 1200 px square</p>
              <p><span className="font-medium text-foreground">Min recommended:</span> 800 x 800 px</p>
              <p><span className="font-medium text-foreground">iPhone photos:</span> HEIC auto-converts to JPEG</p>
              <p><span className="font-medium text-foreground">Auto-optimization:</span> Large images get resized and compressed</p>
            </div>
          </div>
        </AdminSurface>

        <AdminSurface>
          <AdminSectionHeading
            title="Library"
            description="Sort the gallery by type, then quickly rename, hide, reorder, or delete pieces without leaving the page."
          />

          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["all", "flash", "completed"] as const).map((category) => {
              const count =
                category === "all"
                  ? images.length
                  : category === "flash"
                    ? flashCount
                    : completedCount;

              return (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={`inline-flex min-h-[36px] shrink-0 items-center rounded-full px-3 py-1.5 text-xs transition-colors ${
                    categoryFilter === category
                      ? "bg-[var(--ink-900)] text-[var(--sabbia-50)]"
                      : "bg-[var(--sabbia-100)] text-foreground-muted hover:bg-[var(--sabbia-200)]"
                  }`}
                >
                  {CATEGORY_LABELS[category]} ({count})
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            {loading ? (
              <AdminEmptyState
                title="Loading portfolio"
                description="Pulling the current library so you can reorder or clean it up without guessing."
              />
            ) : filteredImages.length === 0 ? (
              <AdminEmptyState
                title={images.length === 0 ? "No images yet" : "Nothing in this filter"}
                description={
                  images.length === 0
                    ? "Upload the first set above and the library will start taking shape here."
                    : "Try another filter or upload more work in this category."
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredImages.map((img, idx) => (
                  <div
                    key={img.id}
                    className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
                      !img.is_visible ? "opacity-60" : ""
                    } ${editingId === img.id ? "border-[var(--trad-red-500)]" : "border-[var(--sabbia-200)]"}`}
                  >
                    <div className="relative aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.title || "Portfolio image"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />

                      {!img.is_visible ? (
                        <div className="absolute left-2 top-2 rounded-full bg-gray-800 px-2 py-1 text-[10px] text-white">
                          Hidden
                        </div>
                      ) : null}

                      <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white">
                        {img.category === "flash" ? "Flash" : "Completed"}
                      </div>
                    </div>

                    <div className="border-t border-[var(--sabbia-200)] p-3">
                      {editingId === img.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(event) => setEditTitle(event.target.value)}
                            placeholder="Title (optional)"
                            className={`${PORTFOLIO_FIELD_CLASSNAME} min-h-[40px] text-xs`}
                            style={{ fontSize: "16px" }}
                          />
                          <select
                            value={editCategory}
                            onChange={(event) => setEditCategory(event.target.value as "flash" | "completed")}
                            className={`${PORTFOLIO_FIELD_CLASSNAME} min-h-[40px] text-xs`}
                            style={{ fontSize: "16px" }}
                          >
                            <option value="flash">Flash</option>
                            <option value="completed">Completed</option>
                          </select>
                          <div className="flex gap-2">
                            <AdminButton
                              type="button"
                              variant="primary"
                              className="flex-1"
                              onClick={() => handleUpdate(img.id, { title: editTitle || null, category: editCategory })}
                            >
                              Save
                            </AdminButton>
                            <AdminButton
                              type="button"
                              variant="ghost"
                              className="flex-1"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </AdminButton>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="truncate text-xs font-medium text-foreground">
                            {img.title || "Untitled"}
                          </p>
                          <p className="mt-1 text-[11px] text-foreground-muted">
                            Position {idx + 1} in {CATEGORY_LABELS[categoryFilter === "all" ? img.category : categoryFilter].toLowerCase()}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleMove(img.id, "up")}
                              disabled={idx === 0}
                              className={PORTFOLIO_CARD_ACTION_CLASSNAME}
                              title="Move left"
                            >
                              Left
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMove(img.id, "down")}
                              disabled={idx === filteredImages.length - 1}
                              className={PORTFOLIO_CARD_ACTION_CLASSNAME}
                              title="Move right"
                            >
                              Right
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(img.id);
                                setEditTitle(img.title || "");
                                setEditCategory(img.category);
                              }}
                              className={PORTFOLIO_CARD_ACTION_CLASSNAME}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdate(img.id, { is_visible: !img.is_visible })}
                              className={PORTFOLIO_CARD_ACTION_CLASSNAME}
                            >
                              {img.is_visible ? "Hide" : "Show"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(img.id)}
                              className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-red-300 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50"
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
        </AdminSurface>
      </div>
    </AdminShell>
  );
}
