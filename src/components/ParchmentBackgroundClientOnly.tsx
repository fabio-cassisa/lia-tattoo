"use client";

import dynamic from "next/dynamic";

const ParchmentBackground = dynamic(() => import("@/components/ParchmentBackground"), {
  ssr: false,
});

export default function ParchmentBackgroundClientOnly() {
  return <ParchmentBackground />;
}
