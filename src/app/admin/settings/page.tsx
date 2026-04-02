"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminShell,
  AdminSurface,
  AdminEmptyState,
} from "@/components/admin/AdminShell";
import {
  AdminAlert,
  AdminButton,
  AdminSectionHeading,
} from "@/components/admin/AdminPrimitives";
import {
  FINANCE_CURRENCY_OPTIONS,
  getContextLabel,
} from "@/lib/finance/config";
import type {
  FinanceContextSettingsRow,
  FinanceCurrency,
  FinanceSettingsRow,
  FinanceWorkContext,
} from "@/lib/supabase/database.types";
import type { FinanceSettingsResponse } from "@/lib/finance/types";

type ContextDraft = FinanceContextSettingsRow;

type SettingsDraft = Pick<
  FinanceSettingsRow,
  | "reporting_currency_primary"
  | "reporting_currency_secondary"
  | "use_live_exchange_rates"
  | "fallback_sek_to_eur"
  | "fallback_dkk_to_eur"
  | "fallback_eur_to_sek"
  | "card_invoice_default"
  | "card_processor_fee_percentage"
  | "sweden_preview_label"
  | "sweden_preview_rate"
  | "sweden_preview_fixed_monthly_cost"
>;

export default function AdminSettingsPage() {
  const router = useRouter();
  const [contexts, setContexts] = useState<ContextDraft[]>([]);
  const [settings, setSettings] = useState<SettingsDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/finance/settings", {
        cache: "no-store",
      });
      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load finance settings");
      }

      const data = (await response.json()) as FinanceSettingsResponse;
      setContexts(data.context_settings);
      setSettings({
        reporting_currency_primary: data.settings.reporting_currency_primary,
        reporting_currency_secondary: data.settings.reporting_currency_secondary,
        use_live_exchange_rates: data.settings.use_live_exchange_rates,
        fallback_sek_to_eur: data.settings.fallback_sek_to_eur,
        fallback_dkk_to_eur: data.settings.fallback_dkk_to_eur,
        fallback_eur_to_sek: data.settings.fallback_eur_to_sek,
        card_invoice_default: data.settings.card_invoice_default,
        card_processor_fee_percentage: data.settings.card_processor_fee_percentage,
        sweden_preview_label: data.settings.sweden_preview_label,
        sweden_preview_rate: data.settings.sweden_preview_rate,
        sweden_preview_fixed_monthly_cost: data.settings.sweden_preview_fixed_monthly_cost,
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load finance settings");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  function updateContext<Key extends keyof ContextDraft>(
    context: FinanceWorkContext,
    key: Key,
    value: ContextDraft[Key]
  ) {
    setContexts((current) =>
      current.map((item) =>
        item.context === context ? { ...item, [key]: value } : item
      )
    );
  }

  function updateSettings<Key extends keyof SettingsDraft>(
    key: Key,
    value: SettingsDraft[Key]
  ) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/finance/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contexts: contexts.map((context) => ({
            context: context.context,
            label: context.label,
            default_currency: context.default_currency,
            default_fee_percentage: Number(context.default_fee_percentage),
            sort_order: context.sort_order,
            is_active: context.is_active,
          })),
          settings,
        }),
      });

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setSuccess("Finance settings saved.");
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Settings"
      description="Centralize the defaults that should quietly save Lia time: studio fees, currencies, invoice nudges, and the reporting behavior behind the finance dashboard."
      activeTab="settings"
      maxWidth="medium"
      actions={
        <AdminButton variant="primary" onClick={handleSave} disabled={saving || loading || !settings}>
          {saving ? "Saving..." : "Save defaults"}
        </AdminButton>
      }
    >
      {error ? (
        <div className="mb-4">
          <AdminAlert>
            {error}
            <button onClick={() => setError("")} className="ml-2 underline">
              dismiss
            </button>
          </AdminAlert>
        </div>
      ) : null}

      {success ? (
        <div className="mb-4">
          <AdminAlert tone="info">{success}</AdminAlert>
        </div>
      ) : null}

      {loading || !settings ? (
        <AdminEmptyState
          title="Loading finance settings"
          description="Pulling the current defaults so this page can act like the admin’s quiet brain instead of a random control panel."
        />
      ) : (
        <div className="space-y-6">
          <AdminSurface>
            <AdminSectionHeading
              title="Work context defaults"
              description="These defaults should do the right thing most of the time, while still being editable on each finance entry when real life gets messy."
            />

            <div className="space-y-4">
              {contexts.map((context) => (
                <div key={context.context} className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <label className="text-sm text-foreground-muted">
                      Label
                      <input
                        value={context.label}
                        onChange={(event) =>
                          updateContext(context.context, "label", event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                        style={{ fontSize: "16px" }}
                      />
                    </label>

                    <label className="text-sm text-foreground-muted">
                      Default currency
                      <select
                        value={context.default_currency}
                        onChange={(event) =>
                          updateContext(
                            context.context,
                            "default_currency",
                            event.target.value as FinanceCurrency
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                        style={{ fontSize: "16px" }}
                      >
                        {FINANCE_CURRENCY_OPTIONS.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm text-foreground-muted">
                      Studio fee %
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={context.default_fee_percentage}
                        onChange={(event) =>
                          updateContext(
                            context.context,
                            "default_fee_percentage",
                            Number(event.target.value)
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                        style={{ fontSize: "16px" }}
                      />
                    </label>

                    <div className="flex items-end">
                      <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-foreground shadow-sm">
                        <input
                          type="checkbox"
                          checked={context.is_active}
                          onChange={(event) =>
                            updateContext(context.context, "is_active", event.target.checked)
                          }
                        />
                        Active context
                      </label>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-foreground-muted">
                    Current context key: {context.context}. Public label preview: {getContextLabel(context.context, contexts)}.
                  </p>
                </div>
              ))}
            </div>
          </AdminSurface>

          <div className="grid gap-6 lg:grid-cols-2">
            <AdminSurface>
              <AdminSectionHeading
                title="Reporting behavior"
                description="Bucket the dashboard by studio context first, then use approximate converted totals only as a helpful overview on top."
              />

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm text-foreground-muted">
                    Primary reporting currency
                    <select
                      value={settings.reporting_currency_primary}
                      onChange={(event) =>
                        updateSettings(
                          "reporting_currency_primary",
                          event.target.value as FinanceCurrency
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                      style={{ fontSize: "16px" }}
                    >
                      {FINANCE_CURRENCY_OPTIONS.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm text-foreground-muted">
                    Secondary reporting currency
                    <select
                      value={settings.reporting_currency_secondary}
                      onChange={(event) =>
                        updateSettings(
                          "reporting_currency_secondary",
                          event.target.value as FinanceCurrency
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                      style={{ fontSize: "16px" }}
                    >
                      {FINANCE_CURRENCY_OPTIONS.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="flex items-center gap-2 rounded-xl bg-[var(--sabbia-50)] px-4 py-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={settings.use_live_exchange_rates}
                    onChange={(event) =>
                      updateSettings("use_live_exchange_rates", event.target.checked)
                    }
                  />
                  Use live exchange rates for approximate normalized totals
                </label>

                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-white p-4 text-sm text-foreground-muted">
                  <p className="font-medium text-foreground">Bucketing rule</p>
                  <p className="mt-2">
                    Sweden studio work is bucketed into SEK, Copenhagen studio work into DKK, and guest/private contexts follow their context default even if the client paid in another currency.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="text-sm text-foreground-muted">
                    SEK → EUR fallback
                    <input
                      type="number"
                      min="0"
                      step="0.000001"
                      value={settings.fallback_sek_to_eur ?? ""}
                      onChange={(event) =>
                        updateSettings(
                          "fallback_sek_to_eur",
                          event.target.value ? Number(event.target.value) : null
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                      style={{ fontSize: "16px" }}
                    />
                  </label>

                  <label className="text-sm text-foreground-muted">
                    DKK → EUR fallback
                    <input
                      type="number"
                      min="0"
                      step="0.000001"
                      value={settings.fallback_dkk_to_eur ?? ""}
                      onChange={(event) =>
                        updateSettings(
                          "fallback_dkk_to_eur",
                          event.target.value ? Number(event.target.value) : null
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                      style={{ fontSize: "16px" }}
                    />
                  </label>

                  <label className="text-sm text-foreground-muted">
                    EUR → SEK fallback
                    <input
                      type="number"
                      min="0"
                      step="0.000001"
                      value={settings.fallback_eur_to_sek ?? ""}
                      onChange={(event) =>
                        updateSettings(
                          "fallback_eur_to_sek",
                          event.target.value ? Number(event.target.value) : null
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                      style={{ fontSize: "16px" }}
                    />
                  </label>
                </div>
              </div>
            </AdminSurface>

            <AdminSurface>
              <AdminSectionHeading
                title="Invoice reminder rules"
                description="Card payments usually need an invoice nudge. The rule should be helpful, never tyrannical."
              />

              <div className="space-y-4 text-sm text-foreground-muted">
                <label className="flex items-center gap-2 rounded-xl bg-[var(--sabbia-50)] px-4 py-3 text-foreground">
                  <input
                    type="checkbox"
                    checked={settings.card_invoice_default}
                    onChange={(event) =>
                      updateSettings("card_invoice_default", event.target.checked)
                    }
                  />
                  Card / SumUp payments default to “invoice needed”
                </label>

                <label className="text-sm text-foreground-muted">
                  SumUp / card processor fee %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={settings.card_processor_fee_percentage}
                    onChange={(event) =>
                      updateSettings(
                        "card_processor_fee_percentage",
                        Number(event.target.value)
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                    style={{ fontSize: "16px" }}
                  />
                </label>

                <p>
                  This keeps the admin honest without forcing Lia into fake certainty. She can still override the reminder per payment when the real-world situation differs.
                </p>

                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-white p-4">
                  <p className="font-medium text-foreground">Current confirmed defaults</p>
                  <ul className="mt-2 space-y-2">
                    <li>Malmö / Studio Diamant: 30%</li>
                    <li>Copenhagen / Good Morning Tattoo: 30%</li>
                    <li>Card / SumUp processor fee: 1.95%</li>
                    <li>Guest spot: configurable, often 40% or 50%</li>
                    <li>Private / home: often 0%</li>
                  </ul>
                </div>
              </div>
            </AdminSurface>

            <AdminSurface>
              <AdminSectionHeading
                title="Sweden Preview"
                description="Keep the Sweden comparison configurable and clearly hypothetical, so it helps decisions without pretending to be legal truth."
              />

              <div className="space-y-4 text-sm text-foreground-muted">
                <label className="text-sm text-foreground-muted">
                  Preview label
                  <input
                    value={settings.sweden_preview_label}
                    onChange={(event) =>
                      updateSettings("sweden_preview_label", event.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                    style={{ fontSize: "16px" }}
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm text-foreground-muted">
                    Approx rate %
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={settings.sweden_preview_rate}
                      onChange={(event) =>
                        updateSettings(
                          "sweden_preview_rate",
                          Number(event.target.value)
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                      style={{ fontSize: "16px" }}
                    />
                  </label>

                  <label className="text-sm text-foreground-muted">
                    Fixed monthly cost
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings.sweden_preview_fixed_monthly_cost}
                      onChange={(event) =>
                        updateSettings(
                          "sweden_preview_fixed_monthly_cost",
                          Number(event.target.value)
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                      style={{ fontSize: "16px" }}
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-white p-4">
                  <p className="font-medium text-foreground">How to use this</p>
                  <p className="mt-2">
                    Treat this as a rough decision-support layer. Use the percentage for broad tax/fee drag and the fixed monthly cost for bookkeeping, insurance, software, or setup overhead you want to pressure-test.
                  </p>
                </div>
              </div>
            </AdminSurface>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
