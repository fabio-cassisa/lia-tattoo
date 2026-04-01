import type { ReactNode } from "react";

export function AdminAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "info";
  children: ReactNode;
}) {
  const toneClass =
    tone === "info"
      ? "border-[var(--sabbia-300)] bg-[var(--sabbia-50)] text-foreground"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClass}`}>
      {children}
    </div>
  );
}

export function AdminButton({
  children,
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const variantClass =
    variant === "primary"
      ? "bg-[var(--ink-900)] text-[var(--sabbia-50)] hover:bg-[var(--ink-800)]"
      : variant === "ghost"
        ? "bg-transparent text-foreground-muted hover:text-foreground"
        : "bg-[var(--sabbia-100)] text-foreground hover:bg-[var(--sabbia-200)]";

  return (
    <button
      className={`inline-flex min-h-[40px] items-center justify-center rounded-xl px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminSectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink-900">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-foreground-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}
