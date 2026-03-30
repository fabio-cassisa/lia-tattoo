"use client";

import { useTranslations } from "next-intl";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  TradDivider,
  LineDivider,
} from "@/components/decorative/TradDivider";
import SlotPicker from "@/components/SlotPicker";
import type { BookingSize } from "@/lib/supabase/database.types";

type SubmitState = "idle" | "submitting" | "success" | "error";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export default function BookingContent() {
  const t = useTranslations("booking");
  const [formData, setFormData] = useState({
    type: "",
    description: "",
    placement: "",
    size: "",
    color: "",
    allergies: "",
    location: "",
    name: "",
    email: "",
    phone: "",
    preferred_dates: "", // Copenhagen only — free text
  });
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Referral tracking — capture on mount ──────────────
  const [referralData, setReferralData] = useState<{
    referrer: string;
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_content: string;
  }>({ referrer: "", utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReferralData({
      referrer: document.referrer || "",
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
    });
  }, []);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  const validateAndAddFiles = useCallback(
    (incoming: File[]) => {
      setFileError("");
      const currentCount = selectedFiles.length;
      const available = MAX_FILES - currentCount;

      if (available <= 0) {
        setFileError(t("reference.tooMany"));
        return;
      }

      const toAdd: File[] = [];
      for (const file of incoming.slice(0, available)) {
        if (file.size > MAX_FILE_SIZE) {
          setFileError(`${file.name} ${t("reference.tooLarge")}`);
          continue;
        }
        // Accept HEIC even if browser reports empty type (common on iOS)
        if (
          file.type &&
          !ALLOWED_TYPES.includes(file.type) &&
          !file.name.toLowerCase().endsWith(".heic")
        ) {
          continue; // silently skip unsupported types
        }
        toAdd.push(file);
      }

      if (incoming.length > available) {
        setFileError(t("reference.tooMany"));
      }

      if (toAdd.length > 0) {
        setSelectedFiles((prev) => [...prev, ...toAdd]);
      }

      // Reset file input so re-selecting the same file works
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [selectedFiles.length, t]
  );

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      validateAndAddFiles(Array.from(e.target.files));
    }
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError("");
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      validateAndAddFiles(Array.from(e.dataTransfer.files));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitState("submitting");
    setErrorMessage("");

    try {
      // Step 1: Create the booking
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: formData.location,
          type: formData.type,
          description: formData.description,
          placement: formData.placement,
          size: formData.size,
          color: formData.color,
          allergies: formData.allergies,
          client_name: formData.name,
          client_email: formData.email,
          client_phone: formData.phone,
          // Malmö: selected calendar slot; Copenhagen: preferred dates as text
          appointment_date: selectedSlot?.start || null,
          appointment_end: selectedSlot?.end || null,
          preferred_dates:
            formData.location === "copenhagen"
              ? formData.preferred_dates
              : null,
          // Referral tracking
          referrer: referralData.referrer,
          utm_source: referralData.utm_source,
          utm_medium: referralData.utm_medium,
          utm_campaign: referralData.utm_campaign,
          utm_content: referralData.utm_content,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.details?.join(", ") || data.error || "Something went wrong"
        );
      }

      const bookingData = await res.json();

      // Step 2: Upload reference images (if any)
      if (selectedFiles.length > 0 && bookingData.booking?.id) {
        const uploadForm = new FormData();
        uploadForm.append("booking_id", bookingData.booking.id);
        for (const file of selectedFiles) {
          uploadForm.append("files", file);
        }

        // Fire and don't block success — images are nice-to-have,
        // the booking itself is what matters
        try {
          await fetch("/api/bookings/images", {
            method: "POST",
            body: uploadForm,
          });
        } catch {
          // Image upload failed silently — booking is already saved
          console.error("Image upload failed, but booking was created");
        }
      }

      setSubmitState("success");
    } catch (err) {
      setSubmitState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong"
      );
    }
  }

  if (submitState === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <TradDivider className="w-32 mb-8" />
        <h1 className="font-display text-3xl sm:text-4xl font-normal text-ink-900 mb-4">
          {t("success")}
        </h1>
        <p className="text-foreground-muted text-sm max-w-md">
          {t("deposit.info")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <section className="pt-10 sm:pt-16 pb-6 sm:pb-8 px-4 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-foreground-muted mb-4">
          liagiorgi.one.ttt
        </p>
        <h1 className="font-display text-4xl sm:text-6xl font-normal text-ink-900 mb-4">
          {t("title")}
        </h1>
        <p className="text-base text-foreground-muted max-w-lg mx-auto">
          {t("subtitle")}
        </p>
        <TradDivider className="w-32 mx-auto mt-8" />
      </section>

      {/* Booking Form */}
      <section className="py-8 sm:py-12 px-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto flex flex-col gap-6 sm:gap-8"
        >
          {/* Error banner */}
          {submitState === "error" && (
            <div className="p-4 border border-accent/30 bg-accent/5 text-sm text-accent">
              {errorMessage}
            </div>
          )}

          {/* Location */}
          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/75">
              {t("location.label")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["malmo", "copenhagen"] as const).map((loc) => (
                <label
                  key={loc}
                  className={`flex items-center gap-3 p-4 border cursor-pointer transition-all ${
                    formData.location === loc
                      ? "border-accent bg-accent/5"
                      : "border-ink-900/10 hover:border-ink-900/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="location"
                    value={loc}
                    checked={formData.location === loc}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      formData.location === loc
                        ? "border-accent"
                        : "border-ink-900/20"
                    }`}
                  >
                    {formData.location === loc && (
                      <span className="w-2 h-2 rounded-full bg-accent" />
                    )}
                  </span>
                  <span className="text-sm font-medium">
                    {t(`location.${loc}`)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <LineDivider className="max-w-xs mx-auto" />

          {/* Type of request */}
          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/75">
              {t("type.label")}
            </label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  "flash",
                  "custom",
                  "consultation",
                  "coverup",
                  "rework",
                ] as const
              ).map((type) => (
                <label
                  key={type}
                  className={`px-4 py-2 border text-sm cursor-pointer transition-all ${
                    formData.type === type
                      ? "border-accent bg-accent/5 text-accent font-medium"
                      : "border-ink-900/10 text-ink-900/75 hover:border-ink-900/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={type}
                    checked={formData.type === type}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  {t(`type.${type}`)}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Description */}
          <fieldset className="flex flex-col gap-2">
            <label
              htmlFor="description"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/75"
            >
              {t("description.label")}
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder={t("description.placeholder")}
              rows={5}
              className="w-full px-4 py-3 bg-sabbia-50 border border-ink-900/10 text-sm text-ink-900 placeholder:text-ink-900/30 focus:border-accent focus:outline-none transition-colors resize-none"
            />
          </fieldset>

          {/* Reference images */}
          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/75">
              {t("reference.label")}
            </label>
            <p className="text-xs text-foreground-muted mb-1">
              {t("reference.hint")}
            </p>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,.heic"
              onChange={handleFileInputChange}
              className="sr-only"
              aria-label={t("reference.upload")}
            />

            {/* Drop zone */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex items-center justify-center w-full h-32 border-2 border-dashed transition-colors cursor-pointer ${
                isDragging
                  ? "border-accent bg-accent/5"
                  : "border-ink-900/10 hover:border-ink-900/20"
              } ${selectedFiles.length >= MAX_FILES ? "opacity-40 pointer-events-none" : ""}`}
            >
              <div className="flex flex-col items-center gap-2 text-ink-900/40">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="text-xs uppercase tracking-wider">
                  {t("reference.upload")}
                </span>
                <span className="text-[10px] text-ink-900/30 normal-case tracking-normal hidden sm:block" aria-hidden="true">
                  {t("reference.drop")}
                </span>
              </div>
            </button>

            {/* Max info */}
            <p className="text-[10px] text-ink-900/35" aria-hidden="true">
              {t("reference.maxInfo")}
            </p>

            {/* File error */}
            {fileError && (
              <p className="text-xs text-accent">{fileError}</p>
            )}

            {/* File previews */}
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-1">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${index}`}
                    className="relative group w-20 h-20 border border-ink-900/10 bg-sabbia-50 overflow-hidden"
                  >
                    {/* Thumbnail — HEIC won't preview, show filename instead */}
                    {file.type && file.type !== "image/heic" ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onLoad={(e) => {
                          // Revoke object URL after image loads to free memory
                          URL.revokeObjectURL(
                            (e.target as HTMLImageElement).src
                          );
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full p-1">
                        <span className="text-[9px] text-ink-900/55 text-center leading-tight break-all">
                          {file.name}
                        </span>
                      </div>
                    )}

                    {/* Remove button — always visible on mobile, hover on desktop */}
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center bg-ink-900/70 text-white text-xs leading-none opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      aria-label={t("reference.remove")}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          {/* Placement & Size row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <fieldset className="flex flex-col gap-2">
              <label
                htmlFor="placement"
                className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/75"
              >
                {t("placement.label")}
              </label>
              <input
                type="text"
                id="placement"
                name="placement"
                value={formData.placement}
                onChange={handleChange}
                placeholder={t("placement.placeholder")}
                className="w-full px-4 py-3 bg-sabbia-50 border border-ink-900/10 text-sm text-ink-900 placeholder:text-ink-900/30 focus:border-accent focus:outline-none transition-colors"
              />
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/75">
                {t("size.label")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["small", "medium", "large", "xlarge"] as const).map(
                  (size) => (
                    <label
                      key={size}
                      className={`px-3 py-2 border text-xs text-center cursor-pointer transition-all ${
                        formData.size === size
                          ? "border-accent bg-accent/5 text-accent font-medium"
                          : "border-ink-900/10 text-ink-900/75 hover:border-ink-900/20"
                      }`}
                    >
                      <input
                        type="radio"
                        name="size"
                        value={size}
                        checked={formData.size === size}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      {t(`size.${size}`)}
                    </label>
                  )
                )}
              </div>
            </fieldset>
          </div>

          {/* Color preference */}
          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/75">
              {t("color.label")}
            </label>
            <div className="flex flex-wrap gap-2">
              {(["blackgrey", "color", "both"] as const).map((color) => (
                <label
                  key={color}
                  className={`px-4 py-2 border text-sm cursor-pointer transition-all ${
                    formData.color === color
                      ? "border-accent bg-accent/5 text-accent font-medium"
                      : "border-ink-900/10 text-ink-900/75 hover:border-ink-900/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="color"
                    value={color}
                    checked={formData.color === color}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  {t(`color.${color}`)}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Allergies */}
          <fieldset className="flex flex-col gap-2">
            <label
              htmlFor="allergies"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/75"
            >
              {t("allergies.label")}
            </label>
            <input
              type="text"
              id="allergies"
              name="allergies"
              value={formData.allergies}
              onChange={handleChange}
              placeholder={t("allergies.placeholder")}
              className="w-full px-4 py-3 bg-sabbia-50 border border-ink-900/10 text-sm text-ink-900 placeholder:text-ink-900/30 focus:border-accent focus:outline-none transition-colors"
            />
          </fieldset>

          <LineDivider className="max-w-xs mx-auto" />

          {/* Date & Time — only show after location and size are selected */}
          {formData.location && (
            <fieldset className="flex flex-col gap-3">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/75">
                {t("calendar.title")}
              </label>

              {formData.location === "malmo" ? (
                // Malmö: calendar slot picker
                formData.size ? (
                  <SlotPicker
                    size={formData.size as BookingSize}
                    selectedSlot={selectedSlot}
                    onSlotSelect={setSelectedSlot}
                  />
                ) : (
                  <p className="text-sm text-ink-900/50 py-4 text-center">
                    {t("calendar.selectSize")}
                  </p>
                )
              ) : (
                // Copenhagen: free text for preferred dates
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-foreground-muted">
                    {t("calendar.copenhagenNote")}
                  </p>
                  <textarea
                    name="preferred_dates"
                    value={formData.preferred_dates}
                    onChange={handleChange}
                    placeholder={t("calendar.copenhagenPlaceholder")}
                    rows={3}
                    className="w-full px-4 py-3 bg-sabbia-50 border border-ink-900/10 text-sm text-ink-900 placeholder:text-ink-900/30 focus:border-accent focus:outline-none transition-colors resize-none"
                  />
                </div>
              )}
            </fieldset>
          )}

          <LineDivider className="max-w-xs mx-auto" />

          {/* Contact info */}
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/75">
              {t("contact.title")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <fieldset className="flex flex-col gap-1">
                <label
                  htmlFor="name"
                   className="text-xs text-ink-900/55"
                >
                  {t("contact.name")}
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-sabbia-50 border border-ink-900/10 text-sm text-ink-900 placeholder:text-ink-900/30 focus:border-accent focus:outline-none transition-colors"
                />
              </fieldset>
              <fieldset className="flex flex-col gap-1">
                <label
                  htmlFor="email"
                   className="text-xs text-ink-900/55"
                >
                  {t("contact.email")}
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-sabbia-50 border border-ink-900/10 text-sm text-ink-900 placeholder:text-ink-900/30 focus:border-accent focus:outline-none transition-colors"
                />
              </fieldset>
            </div>
            <fieldset className="flex flex-col gap-1">
              <label
                htmlFor="phone"
                className="text-xs text-ink-900/40"
              >
                {t("contact.phone")}
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full sm:w-1/2 px-4 py-3 bg-sabbia-50 border border-ink-900/10 text-sm text-ink-900 placeholder:text-ink-900/30 focus:border-accent focus:outline-none transition-colors"
              />
            </fieldset>
          </div>

          {/* Deposit info */}
          <div className="p-4 border border-ink-900/8 bg-sabbia-100/40 text-xs text-foreground-muted space-y-1">
            <p className="font-medium text-ink-900/75">
              {t("deposit.info")}
            </p>
            <p>{t("deposit.small")}</p>
            <p>{t("deposit.large")}</p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitState === "submitting"}
            className="btn-primary px-10 py-4 text-sm tracking-wider self-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitState === "submitting" ? "..." : t("submit")}
          </button>
        </form>
      </section>
    </div>
  );
}
