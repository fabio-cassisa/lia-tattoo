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

export function AdminCheckboxCard({
  checked,
  onChange,
  label,
  description,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  className?: string;
}) {
  return (
    <label
      className={`flex min-h-[52px] cursor-pointer gap-3 rounded-2xl border border-[var(--sabbia-200)] bg-white px-4 py-3 text-left text-foreground shadow-sm ${className}`.trim()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--ink-900)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-5 text-foreground">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs leading-relaxed text-foreground-muted">
            {description}
          </span>
        ) : null}
      </span>
    </label>
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
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink-900">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-foreground-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2 sm:pt-1">{action}</div> : null}
    </div>
  );
}
