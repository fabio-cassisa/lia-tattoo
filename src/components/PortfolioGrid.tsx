"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

type LightboxImage = {
  id: string;
  url: string;
  title: string | null;
};

/**
 * Portfolio image card — clickable, opens lightbox.
 */
export function PortfolioCard({
  image,
  onOpen,
}: {
  image: LightboxImage;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square bg-sabbia-100 border border-ink-900/8 overflow-hidden transition-all hover:border-ink-900/15 hover:shadow-md cursor-pointer w-full text-left"
    >
      <Image
        src={image.url}
        alt={image.title || "Tattoo design"}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        unoptimized
      />
      {image.title && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <p className="text-xs font-medium text-sabbia-50 uppercase tracking-widest">
            {image.title}
          </p>
        </div>
      )}
    </button>
  );
}

/**
 * Portfolio grid with integrated lightbox.
 */
export function PortfolioGrid({ images }: { images: LightboxImage[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);

  const goNext = useCallback(() => {
    setOpenIndex((i) => (i !== null && i < images.length - 1 ? i + 1 : i));
  }, [images.length]);

  const goPrev = useCallback(() => {
    setOpenIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (openIndex === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openIndex, close, goNext, goPrev]);

  const currentImage = openIndex !== null ? images[openIndex] : null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {images.map((image, idx) => (
          <PortfolioCard
            key={image.id}
            image={image}
            onOpen={() => setOpenIndex(idx)}
          />
        ))}
      </div>

      {/* Lightbox overlay */}
      {currentImage && openIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/90 backdrop-blur-sm"
          onClick={close}
        >
          {/* Close button */}
          <button
            onClick={close}
            className="absolute top-4 right-4 z-10 p-2 text-sabbia-50/70 hover:text-sabbia-50 transition-colors"
            aria-label="Close"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>

          {/* Prev arrow */}
          {openIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-2 sm:left-6 z-10 p-3 text-sabbia-50/50 hover:text-sabbia-50 transition-colors"
              aria-label="Previous image"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}

          {/* Next arrow */}
          {openIndex < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-2 sm:right-6 z-10 p-3 text-sabbia-50/50 hover:text-sabbia-50 transition-colors"
              aria-label="Next image"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}

          {/* Image container */}
          <div
            className="relative max-w-[90vw] max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Using img tag here for full-resolution display */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage.url}
              alt={currentImage.title || "Tattoo design"}
              className="max-w-full max-h-[85vh] object-contain rounded"
              draggable={false}
            />

            {/* Title + counter bar */}
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-ink-900/60 to-transparent rounded-b">
              <div className="flex items-center justify-between text-sabbia-50/80">
                <p className="text-sm">
                  {currentImage.title || ""}
                </p>
                <p className="text-xs tabular-nums">
                  {openIndex + 1} / {images.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
