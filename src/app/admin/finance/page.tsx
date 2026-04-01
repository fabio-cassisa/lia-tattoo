import { redirect } from "next/navigation";
import {
  AdminShell,
  AdminSurface,
  AdminMetricCard,
  AdminEmptyState,
} from "@/components/admin/AdminShell";
import {
  AdminButton,
  AdminSectionHeading,
} from "@/components/admin/AdminPrimitives";
import {
  FINANCE_CONTEXT_LABELS,
  FINANCE_CONTEXT_CURRENCY_DEFAULTS,
  FINANCE_CONTEXT_FEE_DEFAULTS,
  FINANCE_PAYMENT_METHOD_LABELS,
} from "@/lib/finance/config";
import type { FinanceWorkContext } from "@/lib/supabase/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }
}

export default async function AdminFinancePage() {
  await requireAdmin();

  const contexts = Object.entries(FINANCE_CONTEXT_LABELS) as Array<[
    FinanceWorkContext,
    string,
  ]>;
  const paymentMethods = Object.entries(FINANCE_PAYMENT_METHOD_LABELS);

  return (
    <AdminShell
      title="Finance"
      description="Track projects, payments, studio fees, and invoice reminders in one clean back office flow built for Lia’s actual month-to-month work."
      activeTab="finance"
      maxWidth="wide"
      actions={<AdminButton variant="primary">Add finance entry</AdminButton>}
    >
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard
          label="This month"
          value="0 entries"
          detail="March and April can be backfilled directly here once the tracker schema lands."
        />
        <AdminMetricCard
          label="Invoice reminders"
          value="0 open"
          tone="warning"
          detail="Card and SumUp payments will default to invoice-needed, but Lia can override per entry."
        />
        <AdminMetricCard
          label="Net totals"
          value="SEK 0 / EUR 0 / DKK 0"
          detail="Base reporting stays split by currency to avoid fake precision."
        />
        <AdminMetricCard
          label="Approx prospect"
          value="EUR 0"
          tone="accent"
          detail="A normalized SEK/EUR view will use rates from settings or a rate service later."
        />
        <AdminMetricCard
          label="Comparison"
          value="No trend yet"
          detail="Week, month, and year comparisons will live here once there is enough data."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <AdminSurface>
          <AdminSectionHeading
            title="Project + payments model"
            description="Version 1 is intentionally structured around tattoos as projects, with one or more payments attached to each project."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-[var(--sabbia-50)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                Project fields
              </p>
              <ul className="mt-3 space-y-2 text-sm text-foreground-muted">
                <li>Client / project name</li>
                <li>Optional linked booking</li>
                <li>Session date</li>
                <li>Work context: Malmö, Copenhagen, guest, private/home</li>
                <li>Notes for edge cases and manual corrections</li>
              </ul>
            </div>

            <div className="rounded-2xl bg-[var(--sabbia-50)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                Payment fields
              </p>
              <ul className="mt-3 space-y-2 text-sm text-foreground-muted">
                <li>Payment date</li>
                <li>Gross amount and currency</li>
                <li>Payment method: cash, card, PayPal, Revolut, Swish, bank transfer</li>
                <li>Studio fee default by context, with per-entry override</li>
                <li>Invoice needed / invoice done reminder</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--sabbia-200)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--sabbia-50)] text-foreground-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Context</th>
                  <th className="px-4 py-3 font-medium">Default currency</th>
                  <th className="px-4 py-3 font-medium">Default fee</th>
                </tr>
              </thead>
              <tbody>
                {contexts.map(([context, label]) => (
                  <tr key={context} className="border-t border-[var(--sabbia-200)] bg-white">
                    <td className="px-4 py-3 text-foreground">{label}</td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {FINANCE_CONTEXT_CURRENCY_DEFAULTS[context]}
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {FINANCE_CONTEXT_FEE_DEFAULTS[context]}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSurface>

        <AdminSurface>
          <AdminSectionHeading
            title="What lands first"
            description="The first finance pass should remove monthly headaches, not simulate a full accounting suite."
          />

          <ol className="space-y-3 text-sm text-foreground-muted">
            <li>1. Add and edit finance projects with one or more payments</li>
            <li>2. Auto-suggest invoice needed for card / SumUp payments</li>
            <li>3. Apply default fee percentages per work context</li>
            <li>4. Show monthly net totals by currency plus approximate SEK/EUR prospect</li>
            <li>5. Backfill March and April directly in admin</li>
          </ol>

          <div className="mt-6 rounded-2xl bg-[var(--sabbia-50)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
              Payment methods ready for v1
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {paymentMethods.map(([method, label]) => (
                <span
                  key={method}
                  className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-xs text-foreground shadow-sm"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </AdminSurface>
      </div>

      <div className="mt-6">
        <AdminEmptyState
          title="Finance workspace is ready for the real build"
          description="Next step is wiring the database schema, settings, and the actual entry flow. The UX shell is here so we can build the tracker without turning the admin into a spreadsheet with lipstick."
          action={<AdminButton variant="secondary">Define finance schema next</AdminButton>}
        />
      </div>
    </AdminShell>
  );
}
