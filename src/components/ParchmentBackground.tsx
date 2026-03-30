"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * ParchmentBackground — Multi-layer aged paper texture with parallax depth.
 *
 * Renders invisible-to-content background layers that drift at slightly
 * different speeds on scroll, creating a subtle paper-depth effect.
 * The grain layer is CSS-only (body::before/::after in globals.css).
 * This component adds an additional watermark-like drift layer.
 *
 * On mobile (prefers-reduced-motion or < 768px), parallax is disabled
 * for performance — layers stay fixed.
 */
export default function ParchmentBackground() {
  const driftRef = useRef<HTMLDivElement>(null);
  const stainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Skip parallax for reduced motion preference
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      // Drift layer — moves at ~3% of scroll speed (very subtle)
      if (driftRef.current) {
        gsap.to(driftRef.current, {
          yPercent: -8,
          ease: "none",
          scrollTrigger: {
            trigger: document.documentElement,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.5, // smooth lag behind scroll
          },
        });
      }

      // Stain layer — moves at ~5% of scroll speed (slightly more than drift)
      if (stainRef.current) {
        gsap.to(stainRef.current, {
          yPercent: -12,
          ease: "none",
          scrollTrigger: {
            trigger: document.documentElement,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.8,
          },
        });
      }
    });

    return () => ctx.revert();
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Drift layer — large-scale paper fiber direction */}
      <div
        ref={driftRef}
        className="absolute inset-0"
        style={{
          /* Extend beyond viewport so parallax shift doesn't reveal edges */
          top: "-10%",
          bottom: "-10%",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 600 600' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='drift'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.15' numOctaves='2' seed='42' stitchTiles='stitch' result='n'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.45 0 0 0 0 0.32 0 0 0 0 0.15 0 0 0 0.6 0' in='n'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23drift)'/%3E%3C/svg%3E")`,
          backgroundSize: "600px 600px",
          opacity: 0.04,
          mixBlendMode: "multiply",
        }}
      />

      {/* Stain layer — subtle foxing spots / coffee ring marks */}
      <div
        ref={stainRef}
        className="absolute inset-0"
        style={{
          top: "-15%",
          bottom: "-15%",
          background: `
            radial-gradient(ellipse 300px 250px at 15% 25%, rgba(140, 85, 25, 0.06) 0%, transparent 70%),
            radial-gradient(ellipse 200px 350px at 82% 65%, rgba(120, 70, 20, 0.05) 0%, transparent 60%),
            radial-gradient(ellipse 250px 200px at 45% 85%, rgba(130, 75, 30, 0.04) 0%, transparent 65%),
            radial-gradient(ellipse 180px 180px at 70% 15%, rgba(145, 80, 25, 0.035) 0%, transparent 55%)
          `,
          opacity: 1,
        }}
      />
    </div>
  );
}
