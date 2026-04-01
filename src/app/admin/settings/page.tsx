import { redirect } from "next/navigation";
import {
  AdminShell,
  AdminSurface,
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
  paymentMethodNeedsInvoiceByDefault,
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

export default async function AdminSettingsPage() {
  await requireAdmin();

  const contexts = Object.entries(FINANCE_CONTEXT_LABELS) as Array<[
    FinanceWorkContext,
    string,
  ]>;

  return (
    <AdminShell
      title="Settings"
      description="Centralize the defaults that should quietly save Lia time: studio fees, work contexts, currency behavior, and invoice reminder rules."
      activeTab="settings"
      maxWidth="medium"
      actions={<AdminButton variant="secondary">Save defaults</AdminButton>}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminSurface>
          <AdminSectionHeading
            title="Work context defaults"
            description="Each context can drive default currency, fee percentage, and future tax/invoice rules without hardcoding them everywhere."
          />

          <div className="space-y-3 text-sm text-foreground-muted">
            {contexts.map(([context, label]) => (
              <div key={context} className="rounded-2xl bg-[var(--sabbia-50)] p-4">
                <p className="font-medium text-foreground">{label}</p>
                <p className="mt-1">
                  Default fee: {FINANCE_CONTEXT_FEE_DEFAULTS[context]}%. Currency: {FINANCE_CONTEXT_CURRENCY_DEFAULTS[context]}. Editable per entry.
                </p>
              </div>
            ))}
          </div>
        </AdminSurface>

        <AdminSurface>
          <AdminSectionHeading
            title="Finance behavior"
            description="These are the high-value rules we already know and should encode once, not remember manually every month."
          />

          <ul className="space-y-3 text-sm text-foreground-muted">
            <li>
              Card / SumUp payments should suggest invoice needed by default: {String(paymentMethodNeedsInvoiceByDefault("card"))}
            </li>
            <li>Invoice reminder must always stay editable per payment</li>
            <li>Monthly reporting should stay split by currency first</li>
            <li>Approximate SEK/EUR prospect view can use exchange-rate settings or a live rate service</li>
            <li>Booking-linked entries should prefill client, context, and likely currency when possible</li>
          </ul>
        </AdminSurface>
      </div>

      <div className="mt-6">
        <AdminEmptyState
          title="Settings will become the quiet brain of the admin"
          description="Once the finance schema exists, this page will hold fee defaults, currency rules, and any future business-profile switch from Italy freelance logic to something Swedish later on."
        />
      </div>
    </AdminShell>
  );
}
