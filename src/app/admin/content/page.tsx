"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { processImageForUpload } from "@/lib/image-processing";
import { AdminShell, AdminSurface } from "@/components/admin/AdminShell";
import { AdminAlert, AdminButton, AdminSectionHeading } from "@/components/admin/AdminPrimitives";
import type { SiteContentKind, SiteContentKey } from "@/lib/supabase/database.types";

type SiteContentItem = {
  key: SiteContentKey;
  title: string | null;
  description: string | null;
  source_en: string;
  it_override: string | null;
  sv_override: string | null;
  da_override: string | null;
  content_kind: SiteContentKind;
  is_active: boolean;
};

type PortfolioFeatureItem = {
  id: string;
  title: string | null;
  category: "flash" | "completed";
  storage_path: string;
  url: string;
  display_order: number;
  is_visible: boolean;
  featured_on_homepage: boolean;
};

type EditableCopyField = "source_en" | "it_override" | "sv_override" | "da_override";

const CONTENT_FIELD_CLASSNAME =
  "w-full rounded-2xl border border-[var(--sabbia-200)] bg-white px-4 py-3 text-sm leading-relaxed text-foreground";

export default function AdminContentPage() {
  const router = useRouter();
  const [content, setContent] = useState<SiteContentItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioFeatureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAboutImage, setUploadingAboutImage] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const aboutImageInputRef = useRef<HTMLInputElement>(null);

  const fetchContent = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/content");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load content");
      setContent(data.content);
      setPortfolio(data.portfolio);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const homepageCandidates = useMemo(
    () => portfolio.filter((item) => item.is_visible).slice(0, 24),
    [portfolio]
  );
  const aboutImageItem = useMemo(
    () => content.find((item) => item.key === "about_profile_image_url"),
    [content]
  );

  function updateContentItem(key: SiteContentKey, field: keyof SiteContentItem, value: string | boolean | null) {
    setContent((current) =>
      current.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  }

  function toggleHomepageFeatured(id: string) {
    setPortfolio((current) =>
      current.map((item) =>
        item.id === id ? { ...item, featured_on_homepage: !item.featured_on_homepage } : item
      )
    );
  }

  function renderTextControl(
    item: SiteContentItem,
    field: EditableCopyField,
    label: string,
    backgroundClassName: string,
    rows = 5,
    hint?: string
  ) {
    const value = item[field] ?? "";
    const sharedClassName = `w-full rounded-2xl border border-[var(--sabbia-200)] px-4 py-3 text-sm leading-relaxed text-foreground ${backgroundClassName}`;
    const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      updateContentItem(item.key, field, field === "source_en" ? nextValue : nextValue || null);
    };

    return (
      <label className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.15em] text-foreground-muted">{label}</span>
        {item.content_kind === "textarea" ? (
          <textarea
            value={value}
            onChange={handleChange}
            rows={rows}
            className={`${sharedClassName} min-h-[168px] resize-y`}
          />
        ) : (
          <input value={value} onChange={handleChange} className={`${sharedClassName} min-h-[48px]`} />
        )}
        {hint ? <span className="text-xs leading-relaxed text-foreground-muted">{hint}</span> : null}
      </label>
    );
  }

  async function handleAboutImageUpload(file: File) {
    setUploadingAboutImage(true);
    setError("");
    setSuccess("");

    try {
      const processed = await processImageForUpload(file);
      const formData = new FormData();
      formData.append("target", "about_profile_image");
      formData.append("file", processed.file);

      const response = await fetch("/api/admin/content", {
        method: "POST",
        body: formData,
      });

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to upload image");

      if (typeof data.url !== "string") {
        throw new Error("Upload returned an invalid image URL");
      }

      updateContentItem("about_profile_image_url", "source_en", data.url);
      setSuccess("About portrait uploaded. Save changes to publish it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploadingAboutImage(false);
      if (aboutImageInputRef.current) {
        aboutImageInputRef.current.value = "";
      }
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          homepage_featured_ids: portfolio.filter((item) => item.featured_on_homepage).map((item) => item.id),
        }),
      });

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save content");

      setSuccess("Site content saved. Public pages will refresh on the next visit.");
      fetchContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save content");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Site Content"
      description="Let Lia update public text and homepage feature picks without needing a code edit every time a sentence changes."
      activeTab="content"
      maxWidth="wide"
      actions={
        <AdminButton variant="primary" onClick={handleSave} disabled={saving || loading}>
          {saving ? "Saving..." : "Save changes"}
        </AdminButton>
      }
      mobileBottomActions={
        loading ? undefined : (
          <AdminButton
            variant="primary"
            className="w-full sm:w-auto"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Saving..." : "Save changes"}
          </AdminButton>
        )
      }
    >
      <div className="space-y-6">
        {error ? <AdminAlert>{error}</AdminAlert> : null}
        {success ? <AdminAlert tone="info">{success}</AdminAlert> : null}

        <AdminSurface>
          <AdminSectionHeading
            title="Structured copy"
            description="English is the canonical source. Italian is the only manual override on this page. Swedish and Danish keep mirroring English automatically unless we decide to open that up later."
          />

          {loading ? (
            <p className="text-sm text-foreground-muted">Loading content…</p>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4 text-sm text-foreground-muted">
                <p className="font-medium text-foreground">Editing scope</p>
                <p className="mt-1">
                  Lia manages the English source copy, an optional Italian override, the about portrait, and the homepage feature image picks here.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--sabbia-200)] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">About portrait</p>
                    <p className="mt-1 text-xs text-foreground-muted">
                      Upload a portrait or paste a direct image URL. This controls the image on the public About page.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={aboutImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,.heic"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void handleAboutImageUpload(file);
                        }
                      }}
                    />
                    <AdminButton
                      type="button"
                      variant="secondary"
                      onClick={() => aboutImageInputRef.current?.click()}
                      disabled={uploadingAboutImage}
                    >
                      {uploadingAboutImage ? "Uploading..." : "Upload portrait"}
                    </AdminButton>
                    <AdminButton
                      type="button"
                      variant="ghost"
                      onClick={() => updateContentItem("about_profile_image_url", "source_en", "")}
                      disabled={uploadingAboutImage}
                    >
                      Remove image
                    </AdminButton>
                  </div>
                </div>

                <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-medium uppercase tracking-[0.15em] text-foreground-muted">
                      Image URL or uploaded file URL
                    </span>
                    <input
                      value={aboutImageItem?.source_en ?? ""}
                      onChange={(event) =>
                        updateContentItem("about_profile_image_url", "source_en", event.target.value)
                      }
                      placeholder="https://... or /path/to/image.jpg"
                      className={CONTENT_FIELD_CLASSNAME}
                    />
                    <span className="text-xs leading-relaxed text-foreground-muted">
                      Uploaded images are stored automatically and pasted here. You can also paste a direct image URL or a relative path.
                    </span>
                  </label>

                  <div className="rounded-2xl border border-dashed border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/70 p-4">
                    {aboutImageItem?.source_en ? (
                      <div className="space-y-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={aboutImageItem.source_en}
                          alt="About portrait preview"
                          className="h-56 w-full rounded-2xl object-cover"
                        />
                        <p className="text-xs leading-relaxed text-foreground-muted">
                          Preview of the public About portrait.
                        </p>
                      </div>
                    ) : (
                      <div className="flex min-h-[224px] items-center justify-center rounded-2xl border border-dashed border-[var(--sabbia-200)] bg-white text-center text-xs leading-relaxed text-foreground-muted">
                        No portrait set yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {content.map((item) => {
                if (item.key === "about_profile_image_url") {
                  return null;
                }

                const isLongform = item.content_kind === "textarea";

                return (
                  <div key={item.key} className="rounded-2xl border border-[var(--sabbia-200)] p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.title ?? item.key}</p>
                        {item.description ? (
                          <p className="mt-1 text-xs text-foreground-muted">{item.description}</p>
                        ) : null}
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs text-foreground-muted">
                        <input
                          type="checkbox"
                          checked={item.is_active}
                          onChange={(event) => updateContentItem(item.key, "is_active", event.target.checked)}
                        />
                        Active
                      </label>
                    </div>

                    <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                      <div className="rounded-2xl bg-[var(--sabbia-50)]/80 p-4">
                        {renderTextControl(
                          item,
                          "source_en",
                          "English source",
                          "bg-white",
                          isLongform ? 7 : 5,
                          "This is the canonical copy all locales fall back to."
                        )}
                      </div>

                      <div className="rounded-2xl border border-dashed border-[var(--sabbia-200)] p-4">
                        {renderTextControl(
                          item,
                          "it_override",
                          "Italian override",
                          "bg-white",
                          isLongform ? 6 : 5,
                          "Leave blank to mirror the English copy automatically."
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AdminSurface>

        <AdminSurface>
          <AdminSectionHeading
            title="Homepage feature picks"
            description="Choose which visible portfolio images can appear in the homepage preview strip. If none are selected, the site falls back to the latest visible work."
          />

          {loading ? (
            <p className="text-sm text-foreground-muted">Loading portfolio…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {homepageCandidates.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => toggleHomepageFeatured(image.id)}
                  className={`overflow-hidden rounded-2xl border text-left transition-all ${
                    image.featured_on_homepage
                      ? "border-[var(--trad-red-500)] bg-red-50/40"
                      : "border-[var(--sabbia-200)] bg-white hover:border-[var(--sabbia-300)]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={image.title || "Portfolio image"}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="space-y-1 p-2">
                    <p className="truncate text-xs font-medium text-foreground">
                      {image.title || "Untitled"}
                    </p>
                    <p className="text-[11px] text-foreground-muted">
                      {image.category === "flash" ? "Flash" : "Completed"}
                    </p>
                    <p className="text-[11px] text-foreground-muted">
                      {image.featured_on_homepage ? "Featured on homepage" : "Not featured"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </AdminSurface>
      </div>
    </AdminShell>
  );
}
