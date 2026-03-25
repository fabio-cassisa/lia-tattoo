/**
 * Traditional tattoo-style decorative divider
 * Inspired by the ornamental borders seen in flash sheets
 */
export function TradDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-4 ${className}`}>
      <div className="h-px flex-1 max-w-20 bg-gradient-to-r from-transparent to-ink-900/20" />
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className="text-accent"
      >
        <path
          d="M12 2L14.5 8.5L21 12L14.5 15.5L12 22L9.5 15.5L3 12L9.5 8.5L12 2Z"
          fill="currentColor"
          opacity="0.8"
        />
      </svg>
      <div className="h-px flex-1 max-w-20 bg-gradient-to-l from-transparent to-ink-900/20" />
    </div>
  );
}

/**
 * Simple horizontal line divider
 */
export function LineDivider({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-px bg-gradient-to-r from-transparent via-ink-900/15 to-transparent ${className}`}
    />
  );
}

/**
 * Corner ornament for framing sections — traditional tattoo border style
 */
export function CornerOrnament({
  position,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const rotations = {
    "top-left": "",
    "top-right": "scale(-1, 1)",
    "bottom-left": "scale(1, -1)",
    "bottom-right": "scale(-1, -1)",
  };

  const positions = {
    "top-left": "top-0 left-0",
    "top-right": "top-0 right-0",
    "bottom-left": "bottom-0 left-0",
    "bottom-right": "bottom-0 right-0",
  };

  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      className={`absolute ${positions[position]} text-ink-900/15`}
      style={{ transform: rotations[position] }}
    >
      <path d="M0 0L0 48" stroke="currentColor" strokeWidth="1.5" />
      <path d="M0 0L48 0" stroke="currentColor" strokeWidth="1.5" />
      <path d="M0 8L8 0" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx="4" cy="4" r="2" fill="currentColor" opacity="0.3" />
    </svg>
  );
}
