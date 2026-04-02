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
  DEFAULT_ACTIVE_TAX_FRAMEWORK,
  DEFAULT_ITALY_INPS_FIXED_ANNUAL_CONTRIBUTION,
  DEFAULT_ITALY_INPS_MIN_TAXABLE_INCOME,
  DEFAULT_ITALY_INPS_REGIME,
  DEFAULT_ITALY_INPS_VARIABLE_RATE,
  DEFAULT_ITALY_PROFITABILITY_COEFFICIENT,
  DEFAULT_ITALY_STANDARD_TAX_RATE,
  DEFAULT_ITALY_STARTUP_TAX_RATE,
  DEFAULT_ITALY_TAX_LABEL,
  DEFAULT_SWEDEN_MUNICIPAL_TAX_RATE,
  DEFAULT_SWEDEN_SELF_EMPLOYMENT_CONTRIBUTION_RATE,
  DEFAULT_SWEDEN_STATE_TAX_RATE,
  DEFAULT_SWEDEN_STATE_TAX_THRESHOLD,
  DEFAULT_SWEDEN_TAX_LABEL,
  FINANCE_FIXED_COST_CADENCE_LABELS,
  FINANCE_FIXED_COST_CADENCE_OPTIONS,
  FINANCE_FIXED_COST_CATEGORY_LABELS,
  FINANCE_ITALY_INPS_REGIME_LABELS,
  FINANCE_ITALY_INPS_REGIME_OPTIONS,
  FINANCE_TAX_FRAMEWORK_LABELS,
  FINANCE_TAX_FRAMEWORK_OPTIONS,
  FINANCE_CURRENCY_OPTIONS,
  getContextLabel,
} from "@/lib/finance/config";
import type {
  FinanceContextSettingsRow,
  FinanceCurrency,
  FinanceFixedCostCadence,
  FinanceItalyInpsRegime,
  FinanceSettingsRow,
  FinanceTaxFramework,
  FinanceWorkContext,
} from "@/lib/supabase/database.types";
import type { FinanceFixedCostDraft, FinanceSettingsResponse } from "@/lib/finance/types";

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
  | "active_tax_framework"
  | "italy_tax_label"
  | "italy_is_startup_eligible"
  | "italy_startup_tax_rate"
  | "italy_standard_tax_rate"
  | "italy_profitability_coefficient"
  | "italy_inps_regime"
  | "italy_inps_min_taxable_income"
  | "italy_inps_fixed_annual_contribution"
  | "italy_inps_variable_rate"
  | "italy_apply_forfettario_inps_reduction"
  | "sweden_tax_label"
  | "sweden_self_employment_contribution_rate"
  | "sweden_municipal_tax_rate"
  | "sweden_state_tax_threshold"
  | "sweden_state_tax_rate"
>;

export default function AdminSettingsPage() {
  const router = useRouter();
  const [contexts, setContexts] = useState<ContextDraft[]>([]);
  const [settings, setSettings] = useState<SettingsDraft | null>(null);
  const [fixedCosts, setFixedCosts] = useState<FinanceFixedCostDraft[]>([]);
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
      setFixedCosts(data.fixed_costs);
      setSettings({
        reporting_currency_primary: data.settings.reporting_currency_primary,
        reporting_currency_secondary: data.settings.reporting_currency_secondary,
        use_live_exchange_rates: data.settings.use_live_exchange_rates,
        fallback_sek_to_eur: data.settings.fallback_sek_to_eur,
        fallback_dkk_to_eur: data.settings.fallback_dkk_to_eur,
        fallback_eur_to_sek: data.settings.fallback_eur_to_sek,
        card_invoice_default: data.settings.card_invoice_default,
        card_processor_fee_percentage: data.settings.card_processor_fee_percentage,
        active_tax_framework:
          data.settings.active_tax_framework ?? DEFAULT_ACTIVE_TAX_FRAMEWORK,
        italy_tax_label: data.settings.italy_tax_label ?? DEFAULT_ITALY_TAX_LABEL,
        italy_is_startup_eligible: data.settings.italy_is_startup_eligible ?? true,
        italy_startup_tax_rate:
          data.settings.italy_startup_tax_rate ?? DEFAULT_ITALY_STARTUP_TAX_RATE,
        italy_standard_tax_rate:
          data.settings.italy_standard_tax_rate ?? DEFAULT_ITALY_STANDARD_TAX_RATE,
        italy_profitability_coefficient:
          data.settings.italy_profitability_coefficient ??
          DEFAULT_ITALY_PROFITABILITY_COEFFICIENT,
        italy_inps_regime: data.settings.italy_inps_regime ?? DEFAULT_ITALY_INPS_REGIME,
        italy_inps_min_taxable_income:
          data.settings.italy_inps_min_taxable_income ??
          DEFAULT_ITALY_INPS_MIN_TAXABLE_INCOME,
        italy_inps_fixed_annual_contribution:
          data.settings.italy_inps_fixed_annual_contribution ??
          DEFAULT_ITALY_INPS_FIXED_ANNUAL_CONTRIBUTION,
        italy_inps_variable_rate:
          data.settings.italy_inps_variable_rate ?? DEFAULT_ITALY_INPS_VARIABLE_RATE,
        italy_apply_forfettario_inps_reduction:
          data.settings.italy_apply_forfettario_inps_reduction ?? true,
        sweden_tax_label: data.settings.sweden_tax_label ?? DEFAULT_SWEDEN_TAX_LABEL,
        sweden_self_employment_contribution_rate:
          data.settings.sweden_self_employment_contribution_rate ??
          DEFAULT_SWEDEN_SELF_EMPLOYMENT_CONTRIBUTION_RATE,
        sweden_municipal_tax_rate:
          data.settings.sweden_municipal_tax_rate ?? DEFAULT_SWEDEN_MUNICIPAL_TAX_RATE,
        sweden_state_tax_threshold:
          data.settings.sweden_state_tax_threshold ?? DEFAULT_SWEDEN_STATE_TAX_THRESHOLD,
        sweden_state_tax_rate:
          data.settings.sweden_state_tax_rate ?? DEFAULT_SWEDEN_STATE_TAX_RATE,
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

  function updateFixedCost(id: string, key: keyof FinanceFixedCostDraft, value: unknown) {
    setFixedCosts((current) =>
      current.map((item) => (item.id === id ? { ...item, [key]: value } : item))
    );
  }

  function updateFixedCostDueMonth(id: string, month: number, checked: boolean) {
    setFixedCosts((current) =>
      current.map((item) => {
        if (item.id !== id) return item;

        const nextDueMonths = checked
          ? [...new Set([...item.due_months, month])].sort((a, b) => a - b)
          : item.due_months.filter((value) => value !== month);

        return { ...item, due_months: nextDueMonths };
      })
    );
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
          fixed_costs: fixedCosts,
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
                title="Tax frameworks"
                description="Configure the actual Italy model and the Sweden comparison model. Both only use payments marked as invoiced, which keeps deposits and non-invoiced cash out of the tax theater."
              />

              <div className="space-y-4 text-sm text-foreground-muted">
                <label className="text-sm text-foreground-muted">
                  Active real-world framework
                  <select
                    value={settings.active_tax_framework}
                    onChange={(event) =>
                      updateSettings(
                        "active_tax_framework",
                        event.target.value as FinanceTaxFramework
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                    style={{ fontSize: "16px" }}
                  >
                    {FINANCE_TAX_FRAMEWORK_OPTIONS.map((framework) => (
                      <option key={framework} value={framework}>
                        {FINANCE_TAX_FRAMEWORK_LABELS[framework]}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-2xl border border-[var(--sabbia-200)] bg-white p-4">
                  <p className="font-medium text-foreground">Booking deposit rule</p>
                  <p className="mt-2">
                    If a booking starts with a non-invoiced PayPal deposit, that deposit can be logged for cashflow but should stay outside the tax simulation. The final session payment should be entered as the remainder and only counted for tax when it is actually invoiced.
                  </p>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                      Italy model
                    </p>
                    <div className="mt-4 space-y-4">
                      <label className="text-sm text-foreground-muted">
                        Label
                        <input
                          value={settings.italy_tax_label}
                          onChange={(event) =>
                            updateSettings("italy_tax_label", event.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                          style={{ fontSize: "16px" }}
                        />
                      </label>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm text-foreground-muted">
                          Startup tax rate %
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={settings.italy_startup_tax_rate}
                            onChange={(event) =>
                              updateSettings(
                                "italy_startup_tax_rate",
                                Number(event.target.value)
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                            style={{ fontSize: "16px" }}
                          />
                        </label>

                        <label className="text-sm text-foreground-muted">
                          Standard tax rate %
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={settings.italy_standard_tax_rate}
                            onChange={(event) =>
                              updateSettings(
                                "italy_standard_tax_rate",
                                Number(event.target.value)
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                            style={{ fontSize: "16px" }}
                          />
                        </label>

                        <label className="text-sm text-foreground-muted">
                          Profitability coefficient %
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={settings.italy_profitability_coefficient}
                            onChange={(event) =>
                              updateSettings(
                                "italy_profitability_coefficient",
                                Number(event.target.value)
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                            style={{ fontSize: "16px" }}
                          />
                        </label>

                        <label className="text-sm text-foreground-muted">
                          INPS regime
                          <select
                            value={settings.italy_inps_regime}
                            onChange={(event) =>
                              updateSettings(
                                "italy_inps_regime",
                                event.target.value as FinanceItalyInpsRegime
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                            style={{ fontSize: "16px" }}
                          >
                            {FINANCE_ITALY_INPS_REGIME_OPTIONS.map((regime) => (
                              <option key={regime} value={regime}>
                                {FINANCE_ITALY_INPS_REGIME_LABELS[regime]}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-sm text-foreground-muted">
                          INPS minimale reddito
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={settings.italy_inps_min_taxable_income}
                            onChange={(event) =>
                              updateSettings(
                                "italy_inps_min_taxable_income",
                                Number(event.target.value)
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                            style={{ fontSize: "16px" }}
                          />
                        </label>

                        <label className="text-sm text-foreground-muted">
                          Fixed annual INPS contribution
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={settings.italy_inps_fixed_annual_contribution}
                            onChange={(event) =>
                              updateSettings(
                                "italy_inps_fixed_annual_contribution",
                                Number(event.target.value)
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                            style={{ fontSize: "16px" }}
                          />
                        </label>

                        <label className="text-sm text-foreground-muted">
                          Variable INPS rate %
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={settings.italy_inps_variable_rate}
                            onChange={(event) =>
                              updateSettings(
                                "italy_inps_variable_rate",
                                Number(event.target.value)
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                            style={{ fontSize: "16px" }}
                          />
                        </label>
                      </div>

                      <label className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-foreground">
                        <input
                          type="checkbox"
                          checked={settings.italy_is_startup_eligible}
                          onChange={(event) =>
                            updateSettings(
                              "italy_is_startup_eligible",
                              event.target.checked
                            )
                          }
                        />
                        Apply startup substitute tax
                      </label>

                      <label className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-foreground">
                        <input
                          type="checkbox"
                          checked={settings.italy_apply_forfettario_inps_reduction}
                          onChange={(event) =>
                            updateSettings(
                              "italy_apply_forfettario_inps_reduction",
                              event.target.checked
                            )
                          }
                        />
                        Apply 35% INPS reduction
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                      Sweden model
                    </p>
                    <div className="mt-4 space-y-4">
                      <label className="text-sm text-foreground-muted">
                        Label
                        <input
                          value={settings.sweden_tax_label}
                          onChange={(event) =>
                            updateSettings("sweden_tax_label", event.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                          style={{ fontSize: "16px" }}
                        />
                      </label>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm text-foreground-muted">
                          Egenavgifter %
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={settings.sweden_self_employment_contribution_rate}
                            onChange={(event) =>
                              updateSettings(
                                "sweden_self_employment_contribution_rate",
                                Number(event.target.value)
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                            style={{ fontSize: "16px" }}
                          />
                        </label>

                        <label className="text-sm text-foreground-muted">
                          Municipal tax %
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={settings.sweden_municipal_tax_rate}
                            onChange={(event) =>
                              updateSettings(
                                "sweden_municipal_tax_rate",
                                Number(event.target.value)
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                            style={{ fontSize: "16px" }}
                          />
                        </label>

                        <label className="text-sm text-foreground-muted">
                          State tax threshold (SEK)
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={settings.sweden_state_tax_threshold}
                            onChange={(event) =>
                              updateSettings(
                                "sweden_state_tax_threshold",
                                Number(event.target.value)
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                            style={{ fontSize: "16px" }}
                          />
                        </label>

                        <label className="text-sm text-foreground-muted">
                          State tax rate %
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={settings.sweden_state_tax_rate}
                            onChange={(event) =>
                              updateSettings(
                                "sweden_state_tax_rate",
                                Number(event.target.value)
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                            style={{ fontSize: "16px" }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AdminSurface>

            <AdminSurface>
              <AdminSectionHeading
                title="Fixed business costs"
                description="Keep statutory and recurring overhead standardized here. Missing amounts stay visible but excluded from totals until you know them."
              />

              <div className="space-y-4 text-sm text-foreground-muted">
                {fixedCosts.map((cost) => (
                  <div
                    key={cost.id}
                    className="rounded-2xl border border-[var(--sabbia-200)] bg-[var(--sabbia-50)]/80 p-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <label className="text-sm text-foreground-muted">
                        Label
                        <input
                          value={cost.label}
                          onChange={(event) => updateFixedCost(cost.id, "label", event.target.value)}
                          className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                          style={{ fontSize: "16px" }}
                        />
                      </label>

                      <div className="text-sm text-foreground-muted">
                        Category
                        <div className="mt-1 rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-foreground">
                          {FINANCE_FIXED_COST_CATEGORY_LABELS[cost.category]}
                        </div>
                      </div>

                      <label className="text-sm text-foreground-muted">
                        Annual amount
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cost.annual_amount ?? ""}
                          onChange={(event) =>
                            updateFixedCost(
                              cost.id,
                              "annual_amount",
                              event.target.value ? Number(event.target.value) : null
                            )
                          }
                          placeholder="Amount pending"
                          className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                          style={{ fontSize: "16px" }}
                        />
                      </label>

                      <label className="text-sm text-foreground-muted">
                        Cadence
                        <select
                          value={cost.cadence}
                          onChange={(event) =>
                            updateFixedCost(
                              cost.id,
                              "cadence",
                              event.target.value as FinanceFixedCostCadence
                            )
                          }
                          className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                          style={{ fontSize: "16px" }}
                        >
                          {FINANCE_FIXED_COST_CADENCE_OPTIONS.map((cadence) => (
                            <option key={cadence} value={cadence}>
                              {FINANCE_FIXED_COST_CADENCE_LABELS[cadence]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="text-sm text-foreground-muted">
                        Notes
                        <input
                          value={cost.notes ?? ""}
                          onChange={(event) =>
                            updateFixedCost(cost.id, "notes", event.target.value || null)
                          }
                          className="mt-1 w-full rounded-xl border border-[var(--sabbia-200)] bg-white px-3 py-2 text-sm text-foreground"
                          style={{ fontSize: "16px" }}
                        />
                      </label>

                      <div className="text-sm text-foreground-muted">
                        Due months
                        <div className="mt-1 grid grid-cols-4 gap-2 rounded-xl border border-[var(--sabbia-200)] bg-white p-3 text-xs text-foreground-muted sm:grid-cols-6">
                          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                            <label key={month} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={cost.due_months.includes(month)}
                                onChange={(event) =>
                                  updateFixedCostDueMonth(cost.id, month, event.target.checked)
                                }
                              />
                              {String(month).padStart(2, "0")}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-end gap-3">
                        <label className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-foreground">
                          <input
                            type="checkbox"
                            checked={cost.already_counted_in_tax_model}
                            onChange={(event) =>
                              updateFixedCost(
                                cost.id,
                                "already_counted_in_tax_model",
                                event.target.checked
                              )
                            }
                          />
                          Already counted in tax model
                        </label>
                        <label className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-foreground">
                          <input
                            type="checkbox"
                            checked={cost.is_active}
                            onChange={(event) =>
                              updateFixedCost(cost.id, "is_active", event.target.checked)
                            }
                          />
                          Active
                        </label>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-foreground-muted">
                      {cost.framework ? `${FINANCE_TAX_FRAMEWORK_LABELS[cost.framework]} model` : "Shared"} · {cost.currency}
                      {cost.annual_amount === null ? " · amount pending" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </AdminSurface>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
