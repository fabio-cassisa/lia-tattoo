"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type BerrySprigVariant = "strawberry" | "raspberry";

type BerrySprigProps = {
  variant: BerrySprigVariant;
  src: string;
  sizes: string;
  className?: string;
  loading?: "eager" | "lazy";
};

type BerryVariantConfig = {
  imageInset: CSSProperties;
  stemPaths: string[];
  leafPaths: string[];
  stemStroke: string;
  leafFill: string;
  leafStroke: string;
  imageOpacity: number;
  scrollScale: number;
  scrollYPercent: number;
  scrollRotation: number;
  fruitOrigin: string;
  stemOrigin: string;
};

const BERRY_VARIANTS: Record<BerrySprigVariant, BerryVariantConfig> = {
  strawberry: {
    imageInset: {
      top: "10%",
      right: "6%",
      bottom: "8%",
      left: "20%",
    },
    stemPaths: [
      "M14 132C17 114 24 98 35 83C48 64 63 45 82 24",
      "M35 84C39 73 47 63 60 52",
      "M47 66C55 57 66 46 75 36",
    ],
    leafPaths: [
      "M27 96C36 86 47 86 54 94C44 101 33 101 27 96Z",
      "M49 66C59 55 71 55 79 64C68 73 57 73 49 66Z",
      "M65 44C73 36 83 35 89 42C81 50 72 50 65 44Z",
    ],
    stemStroke: "rgba(88, 84, 46, 0.28)",
    leafFill: "rgba(113, 121, 72, 0.14)",
    leafStroke: "rgba(70, 67, 38, 0.14)",
    imageOpacity: 0.15,
    scrollScale: 1.12,
    scrollYPercent: -12,
    scrollRotation: 5,
    fruitOrigin: "18% 88%",
    stemOrigin: "14% 100%",
  },
  raspberry: {
    imageInset: {
      top: "12%",
      right: "8%",
      bottom: "8%",
      left: "16%",
    },
    stemPaths: [
      "M18 132C21 114 28 100 39 86C51 68 63 48 74 25",
      "M39 86C48 79 58 72 69 69",
      "M52 67C61 58 72 52 85 49",
    ],
    leafPaths: [
      "M29 101C38 92 49 92 56 100C46 108 35 108 29 101Z",
      "M55 72C64 61 77 60 84 69C73 78 62 79 55 72Z",
      "M68 50C76 42 87 41 92 48C84 56 74 56 68 50Z",
    ],
    stemStroke: "rgba(82, 80, 46, 0.25)",
    leafFill: "rgba(102, 112, 68, 0.12)",
    leafStroke: "rgba(66, 65, 38, 0.12)",
    imageOpacity: 0.12,
    scrollScale: 1.1,
    scrollYPercent: -10,
    scrollRotation: 4,
    fruitOrigin: "22% 90%",
    stemOrigin: "18% 100%",
  },
};

export function BerrySprig({
  variant,
  src,
  sizes,
  className = "",
  loading = "lazy",
}: BerrySprigProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stemGroupRef = useRef<SVGGElement>(null);
  const fruitRef = useRef<HTMLDivElement>(null);

  const config = BERRY_VARIANTS[variant];

  useEffect(() => {
    const root = rootRef.current;
    const stemGroup = stemGroupRef.current;
    const fruit = fruitRef.current;

    if (!root || !stemGroup || !fruit) return;

    const stemPaths = gsap.utils.toArray<SVGPathElement>(
      stemGroup.querySelectorAll("[data-stem-path]")
    );
    const leaves = gsap.utils.toArray<SVGPathElement>(
      stemGroup.querySelectorAll("[data-stem-leaf]")
    );

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isCompact = window.matchMedia("(max-width: 767px)").matches;

    const ctx = gsap.context(() => {
      gsap.set(stemPaths, { strokeDasharray: 1, strokeDashoffset: 1 });

      if (prefersReduced) {
        gsap.set(stemPaths, { strokeDashoffset: 0 });
        gsap.set(leaves, { autoAlpha: 1, scale: 1 });
        gsap.set(fruit, { autoAlpha: 1, y: 0, scale: 1, rotation: 0 });
        return;
      }

      gsap.set(leaves, {
        autoAlpha: 0,
        scale: 0.82,
        transformOrigin: "50% 50%",
      });

      gsap.set(fruit, {
        autoAlpha: 0,
        y: 18,
        scale: 0.84,
        rotation: config.scrollRotation * -0.35,
        transformOrigin: config.fruitOrigin,
      });

      const intro = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: "top 86%",
          once: true,
        },
      });

      intro
        .to(stemPaths, {
          strokeDashoffset: 0,
          duration: 1.05,
          ease: "power2.out",
          stagger: 0.08,
        })
        .to(
          leaves,
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.5,
            ease: "power2.out",
            stagger: 0.06,
          },
          "-=0.5"
        )
        .to(
          fruit,
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotation: 0,
            duration: 0.9,
            ease: "power3.out",
          },
          "-=0.42"
        );

      const scrollScale = isCompact
        ? 1 + (config.scrollScale - 1) * 0.6
        : config.scrollScale;
      const scrollYPercent = isCompact
        ? config.scrollYPercent * 0.65
        : config.scrollYPercent;
      const scrollRotation = isCompact
        ? config.scrollRotation * 0.6
        : config.scrollRotation;

      gsap.fromTo(
        stemGroup,
        { scaleX: 1, scaleY: 1 },
        {
          scaleX: 1.02,
          scaleY: scrollScale,
          transformOrigin: config.stemOrigin,
          ease: "none",
          immediateRender: false,
          scrollTrigger: {
            trigger: root,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.9,
          },
        }
      );

      gsap.fromTo(
        fruit,
        { scale: 1, yPercent: 0, rotation: 0 },
        {
          scale: scrollScale,
          yPercent: scrollYPercent,
          rotation: scrollRotation,
          transformOrigin: config.fruitOrigin,
          ease: "none",
          immediateRender: false,
          scrollTrigger: {
            trigger: root,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.85,
          },
        }
      );
    }, root);

    return () => ctx.revert();
  }, [config]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={`pointer-events-none absolute overflow-visible ${className}`}
    >
      <svg
        viewBox="0 0 100 140"
        className="absolute inset-0 h-full w-full overflow-visible mix-blend-multiply"
      >
        <g ref={stemGroupRef}>
          {config.stemPaths.map((path, index) => (
            <path
              key={`stem-${index}`}
              data-stem-path
              pathLength="1"
              d={path}
              fill="none"
              stroke={config.stemStroke}
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {config.leafPaths.map((path, index) => (
            <path
              key={`leaf-${index}`}
              data-stem-leaf
              d={path}
              fill={config.leafFill}
              stroke={config.leafStroke}
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
          ))}
        </g>
      </svg>

      <div
        ref={fruitRef}
        className="absolute inset-0 will-change-transform"
        style={config.imageInset}
      >
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          loading={loading}
          className="object-contain mix-blend-multiply"
          style={{ opacity: config.imageOpacity }}
        />
      </div>
    </div>
  );
}
