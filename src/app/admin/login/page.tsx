"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSurface } from "@/components/admin/AdminShell";
import { AdminAlert, AdminButton } from "@/components/admin/AdminPrimitives";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }

      router.push("/admin");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--sabbia-50)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <AdminSurface className="w-full rounded-3xl p-6 sm:p-8">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.35em] text-foreground-muted">
              liagiorgi.one.ttt
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-ink-900">
              Admin sign in
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
              Keep the booking queue, portfolio, and finance brain behind the site locked to the right hands.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error ? <AdminAlert>{error}</AdminAlert> : null}

            <label htmlFor="email" className="block text-sm text-foreground-muted">
              Email
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-base text-foreground focus:border-[var(--trad-red-500)] focus:outline-none focus:ring-1 focus:ring-[var(--trad-red-500)]"
                style={{ fontSize: "16px" }}
              />
            </label>

            <label htmlFor="password" className="block text-sm text-foreground-muted">
              Password
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-base text-foreground focus:border-[var(--trad-red-500)] focus:outline-none focus:ring-1 focus:ring-[var(--trad-red-500)]"
                style={{ fontSize: "16px" }}
              />
            </label>

            <AdminButton type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? "Signing in..." : "Sign in"}
            </AdminButton>
          </form>
        </AdminSurface>
      </div>
    </div>
  );
}
