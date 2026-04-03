"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type TattooArtworkProps = {
  src: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
  loading?: "eager" | "lazy";
  introDelay?: number;
  parallax?: number;
};

export function TattooArtwork({
  src,
  sizes,
  className = "",
  imageClassName = "",
  loading = "lazy",
  introDelay = 0,
  parallax = 0,
}: TattooArtworkProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const art = artRef.current;

    if (!root || !art) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isCompact = window.matchMedia("(max-width: 767px)").matches;

    const ctx = gsap.context(() => {
      if (prefersReduced) {
        gsap.set(art, { autoAlpha: 1, y: 0, scale: 1, rotation: 0 });
        return;
      }

      gsap.set(art, {
        autoAlpha: 0,
        y: isCompact ? 26 : 34,
        scale: isCompact ? 0.8 : 0.74,
        rotation: -7,
        transformOrigin: "50% 70%",
      });

      gsap.to(art, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        rotation: 0,
        duration: 0.92,
        delay: introDelay,
        ease: "back.out(1.25)",
        scrollTrigger: {
          trigger: root,
          start: "top 88%",
          once: true,
        },
      });

      if (parallax > 0) {
        gsap.fromTo(
          art,
          { yPercent: 0 },
          {
            yPercent: isCompact ? parallax * -0.65 : parallax * -1,
            ease: "none",
            immediateRender: false,
            scrollTrigger: {
              trigger: root,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.75,
            },
          }
        );
      }
    }, root);

    return () => ctx.revert();
  }, [introDelay, parallax]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={`pointer-events-none absolute overflow-visible ${className}`}
    >
      <div ref={artRef} className="absolute inset-0 will-change-transform">
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          loading={loading}
          className={`object-contain ${imageClassName}`}
        />
      </div>
    </div>
  );
}
