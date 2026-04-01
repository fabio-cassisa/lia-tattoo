"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AdminTab = "bookings" | "portfolio" | "insights" | "finance" | "settings";
type AdminShellWidth = "narrow" | "medium" | "wide";
type AdminMetricTone = "default" | "accent" | "warning" | "success";

type AdminShellProps = {
  title: string;
  description: string;
  activeTab: AdminTab;
  children: ReactNode;
  actions?: ReactNode;
  maxWidth?: AdminShellWidth;
};

type AdminSurfaceProps = {
  children: ReactNode;
  className?: string;
};

type AdminMetricCardProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: AdminMetricTone;
};

type AdminEmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

const NAV_ITEMS: Array<{ key: AdminTab; label: string; href: string }> = [
  { key: "bookings", label: "Bookings", href: "/admin" },
  { key: "portfolio", label: "Portfolio", href: "/admin/portfolio" },
  { key: "insights", label: "Creative Coach", href: "/admin/insights" },
  { key: "finance", label: "Finance", href: "/admin/finance" },
  { key: "settings", label: "Settings", href: "/admin/settings" },
];

const WIDTH_CLASSES: Record<AdminShellWidth, string> = {
  narrow: "max-w-4xl",
  medium: "max-w-5xl",
  wide: "max-w-7xl",
};

const METRIC_TONE_CLASSES: Record<AdminMetricTone, string> = {
  default: "bg-white border-[var(--sabbia-200)]",
  accent: "bg-[var(--sabbia-50)] border-[var(--trad-red-500)]/25",
  warning: "bg-amber-50 border-amber-200",
  success: "bg-emerald-50 border-emerald-200",
};

export function AdminShell({
  title,
  description,
  activeTab,
  children,
  actions,
  maxWidth = "wide",
}: AdminShellProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    document.cookie = "sb-access-token=; path=/; max-age=0";
    document.cookie = "sb-refresh-token=; path=/; max-age=0";
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen">
      <div className={`mx-auto w-full ${WIDTH_CLASSES[maxWidth]} px-4 py-4 sm:px-6 sm:py-6`}>
        <header className="mb-6 border-b border-ink-900/10 pb-4 sm:pb-6">
          <div className="flex flex-col gap-4 sm:gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.35em] text-foreground-muted">
                  liagiorgi.one.ttt
                </p>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-3xl">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted">
                    {description}
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:items-end">
                {actions ? (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {actions}
                  </div>
                ) : null}

                <button
                  onClick={handleLogout}
                  className="inline-flex min-h-[44px] items-center justify-center text-sm text-foreground-muted transition-colors hover:text-foreground"
                >
                  Sign out
                </button>
              </div>
            </div>

            <nav className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              <div className="flex w-max min-w-full gap-2">
                {NAV_ITEMS.map((item) =>
                  item.key === activeTab ? (
                    <span
                      key={item.key}
                      className="inline-flex min-h-[36px] items-center rounded-full bg-[var(--ink-900)] px-3 py-1.5 text-xs text-[var(--sabbia-50)]"
                    >
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="inline-flex min-h-[36px] items-center rounded-full bg-[var(--sabbia-100)] px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:bg-[var(--sabbia-200)]"
                    >
                      {item.label}
                    </Link>
                  )
                )}
              </div>
            </nav>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

export function AdminSurface({ children, className = "" }: AdminSurfaceProps) {
  return (
    <section
      className={`rounded-2xl border border-[var(--sabbia-200)] bg-white/90 p-4 shadow-sm sm:p-5 ${className}`.trim()}
    >
      {children}
    </section>
  );
}

export function AdminMetricCard({
  label,
  value,
  detail,
  tone = "default",
}: AdminMetricCardProps) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${METRIC_TONE_CLASSES[tone]}`}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
        {label}
      </p>
      <div className="mt-2 text-xl font-medium text-foreground sm:text-2xl">
        {value}
      </div>
      {detail ? (
        <div className="mt-2 text-xs leading-relaxed text-foreground-muted">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
}: AdminEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--sabbia-300)] bg-[var(--sabbia-50)]/80 px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink-900/35 shadow-sm">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 3v18M3 12h18" />
        </svg>
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-[-0.01em] text-ink-900">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-foreground-muted">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
