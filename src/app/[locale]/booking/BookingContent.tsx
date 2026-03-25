"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  TradDivider,
  LineDivider,
} from "@/components/decorative/TradDivider";

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
  });
  const [submitted, setSubmitted] = useState(false);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: wire to API route
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <TradDivider className="w-32 mb-8" />
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-900 mb-4">
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
        <h1 className="font-display text-4xl sm:text-6xl font-bold text-ink-900 mb-4">
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
          {/* Location */}
          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/60">
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
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/60">
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
                      : "border-ink-900/10 text-ink-900/60 hover:border-ink-900/20"
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
              className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/60"
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
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/60">
              {t("reference.label")}
            </label>
            <p className="text-xs text-foreground-muted mb-1">
              {t("reference.hint")}
            </p>
            <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-ink-900/10 hover:border-ink-900/20 transition-colors cursor-pointer">
              <div className="flex flex-col items-center gap-2 text-ink-900/30">
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
              </div>
            </div>
          </fieldset>

          {/* Placement & Size row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <fieldset className="flex flex-col gap-2">
              <label
                htmlFor="placement"
                className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/60"
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
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/60">
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
                          : "border-ink-900/10 text-ink-900/60 hover:border-ink-900/20"
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
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/60">
              {t("color.label")}
            </label>
            <div className="flex flex-wrap gap-2">
              {(["blackgrey", "color", "both"] as const).map((color) => (
                <label
                  key={color}
                  className={`px-4 py-2 border text-sm cursor-pointer transition-all ${
                    formData.color === color
                      ? "border-accent bg-accent/5 text-accent font-medium"
                      : "border-ink-900/10 text-ink-900/60 hover:border-ink-900/20"
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
              className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/60"
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

          {/* Contact info */}
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/60">
              {t("contact.title")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <fieldset className="flex flex-col gap-1">
                <label
                  htmlFor="name"
                  className="text-xs text-ink-900/40"
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
                  className="text-xs text-ink-900/40"
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
            <p className="font-medium text-ink-900/60">
              {t("deposit.info")}
            </p>
            <p>{t("deposit.small")}</p>
            <p>{t("deposit.large")}</p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn-primary px-10 py-4 text-sm tracking-wider self-center"
          >
            {t("submit")}
          </button>
        </form>
      </section>
    </div>
  );
}
