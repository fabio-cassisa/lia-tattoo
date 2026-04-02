import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  FinanceCurrency,
  FinanceSettingsRow,
  FinanceWorkContext,
} from "@/lib/supabase/database.types";
import type { FinanceSettingsResponse } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

async function requireAuth() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

function isFinanceWorkContext(value: unknown): value is FinanceWorkContext {
  return [
    "malmo_studio",
    "copenhagen_studio",
    "guest_spot",
    "private_home",
  ].includes(String(value));
}

function isCurrency(value: unknown): value is FinanceCurrency {
  return ["SEK", "DKK", "EUR"].includes(String(value));
}

function isTaxFramework(value: unknown): value is FinanceSettingsRow["active_tax_framework"] {
  return ["italy", "sweden"].includes(String(value));
}

function isItalyInpsRegime(value: unknown): value is FinanceSettingsRow["italy_inps_regime"] {
  return ["artigiani", "commercianti"].includes(String(value));
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

async function buildSettingsResponse(admin = createAdminClient()): Promise<FinanceSettingsResponse> {
  const [contextResult, settingsResult, fixedCostsResult] = await Promise.all([
    admin
      .from("finance_context_settings")
      .select("*")
      .order("sort_order", { ascending: true }),
    admin.from("finance_settings").select("*").eq("scope", "default").single(),
    admin
      .from("finance_fixed_costs")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (contextResult.error) throw contextResult.error;
  if (settingsResult.error) throw settingsResult.error;
  if (fixedCostsResult.error) throw fixedCostsResult.error;

  return {
    context_settings: contextResult.data ?? [],
    settings: settingsResult.data as FinanceSettingsRow,
    fixed_costs: fixedCostsResult.data ?? [],
  };
}

export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await buildSettingsResponse();
    return Response.json(response);
  } catch (error) {
    console.error("Finance settings fetch error:", error);
    return Response.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      contexts?: Array<Record<string, unknown>>;
      settings?: Record<string, unknown>;
      fixed_costs?: Array<Record<string, unknown>>;
    };

    const admin = createAdminClient();

    if (body.settings) {
      const settingsUpdates: Record<string, unknown> = {};

      if (isCurrency(body.settings.reporting_currency_primary)) {
        settingsUpdates.reporting_currency_primary = body.settings.reporting_currency_primary;
      }
      if (isCurrency(body.settings.reporting_currency_secondary)) {
        settingsUpdates.reporting_currency_secondary = body.settings.reporting_currency_secondary;
      }
      if (getBoolean(body.settings.use_live_exchange_rates) !== null) {
        settingsUpdates.use_live_exchange_rates = getBoolean(body.settings.use_live_exchange_rates);
      }
      if (getNumber(body.settings.fallback_sek_to_eur) !== null) {
        settingsUpdates.fallback_sek_to_eur = getNumber(body.settings.fallback_sek_to_eur);
      }
      if (getNumber(body.settings.fallback_dkk_to_eur) !== null) {
        settingsUpdates.fallback_dkk_to_eur = getNumber(body.settings.fallback_dkk_to_eur);
      }
      if (getNumber(body.settings.fallback_eur_to_sek) !== null) {
        settingsUpdates.fallback_eur_to_sek = getNumber(body.settings.fallback_eur_to_sek);
      }
      if (getBoolean(body.settings.card_invoice_default) !== null) {
        settingsUpdates.card_invoice_default = getBoolean(body.settings.card_invoice_default);
      }
      if (getNumber(body.settings.card_processor_fee_percentage) !== null) {
        settingsUpdates.card_processor_fee_percentage = getNumber(
          body.settings.card_processor_fee_percentage
        );
      }
      if (isTaxFramework(body.settings.active_tax_framework)) {
        settingsUpdates.active_tax_framework = body.settings.active_tax_framework;
      }
      if (getString(body.settings.italy_tax_label) !== null) {
        settingsUpdates.italy_tax_label = getString(body.settings.italy_tax_label);
      }
      if (getBoolean(body.settings.italy_is_startup_eligible) !== null) {
        settingsUpdates.italy_is_startup_eligible = getBoolean(
          body.settings.italy_is_startup_eligible
        );
      }
      if (getNumber(body.settings.italy_startup_tax_rate) !== null) {
        settingsUpdates.italy_startup_tax_rate = getNumber(
          body.settings.italy_startup_tax_rate
        );
      }
      if (getNumber(body.settings.italy_standard_tax_rate) !== null) {
        settingsUpdates.italy_standard_tax_rate = getNumber(
          body.settings.italy_standard_tax_rate
        );
      }
      if (getNumber(body.settings.italy_profitability_coefficient) !== null) {
        settingsUpdates.italy_profitability_coefficient = getNumber(
          body.settings.italy_profitability_coefficient
        );
      }
      if (isItalyInpsRegime(body.settings.italy_inps_regime)) {
        settingsUpdates.italy_inps_regime = body.settings.italy_inps_regime;
      }
      if (getNumber(body.settings.italy_inps_min_taxable_income) !== null) {
        settingsUpdates.italy_inps_min_taxable_income = getNumber(
          body.settings.italy_inps_min_taxable_income
        );
      }
      if (getNumber(body.settings.italy_inps_fixed_annual_contribution) !== null) {
        settingsUpdates.italy_inps_fixed_annual_contribution = getNumber(
          body.settings.italy_inps_fixed_annual_contribution
        );
      }
      if (getNumber(body.settings.italy_inps_variable_rate) !== null) {
        settingsUpdates.italy_inps_variable_rate = getNumber(
          body.settings.italy_inps_variable_rate
        );
      }
      if (getBoolean(body.settings.italy_apply_forfettario_inps_reduction) !== null) {
        settingsUpdates.italy_apply_forfettario_inps_reduction = getBoolean(
          body.settings.italy_apply_forfettario_inps_reduction
        );
      }
      if (getString(body.settings.sweden_tax_label) !== null) {
        settingsUpdates.sweden_tax_label = getString(body.settings.sweden_tax_label);
      }
      if (getNumber(body.settings.sweden_self_employment_contribution_rate) !== null) {
        settingsUpdates.sweden_self_employment_contribution_rate = getNumber(
          body.settings.sweden_self_employment_contribution_rate
        );
      }
      if (getNumber(body.settings.sweden_municipal_tax_rate) !== null) {
        settingsUpdates.sweden_municipal_tax_rate = getNumber(
          body.settings.sweden_municipal_tax_rate
        );
      }
      if (getNumber(body.settings.sweden_state_tax_threshold) !== null) {
        settingsUpdates.sweden_state_tax_threshold = getNumber(
          body.settings.sweden_state_tax_threshold
        );
      }
      if (getNumber(body.settings.sweden_state_tax_rate) !== null) {
        settingsUpdates.sweden_state_tax_rate = getNumber(
          body.settings.sweden_state_tax_rate
        );
      }
      if (getString(body.settings.sweden_preview_label) !== null) {
        settingsUpdates.sweden_preview_label = getString(body.settings.sweden_preview_label);
      }
      if (getNumber(body.settings.sweden_preview_rate) !== null) {
        settingsUpdates.sweden_preview_rate = getNumber(body.settings.sweden_preview_rate);
      }
      if (getNumber(body.settings.sweden_preview_fixed_monthly_cost) !== null) {
        settingsUpdates.sweden_preview_fixed_monthly_cost = getNumber(
          body.settings.sweden_preview_fixed_monthly_cost
        );
      }

      if (Object.keys(settingsUpdates).length > 0) {
        const { error } = await admin
          .from("finance_settings")
          .update(settingsUpdates)
          .eq("scope", "default");

        if (error) {
          console.error("Finance settings update error:", error);
          return Response.json({ error: "Failed to update finance settings" }, { status: 500 });
        }
      }
    }

    if (body.contexts?.length) {
      for (const context of body.contexts) {
        if (!isFinanceWorkContext(context.context)) {
          continue;
        }

        const updates: Record<string, unknown> = {};
        if (getString(context.label) !== null) updates.label = getString(context.label);
        if (isCurrency(context.default_currency)) updates.default_currency = context.default_currency;
        if (getNumber(context.default_fee_percentage) !== null) {
          updates.default_fee_percentage = getNumber(context.default_fee_percentage);
        }
        if (getNumber(context.sort_order) !== null) updates.sort_order = getNumber(context.sort_order);
        if (getBoolean(context.is_active) !== null) updates.is_active = getBoolean(context.is_active);

        if (Object.keys(updates).length === 0) {
          continue;
        }

        const { error } = await admin
          .from("finance_context_settings")
          .update(updates)
          .eq("context", context.context);

        if (error) {
          console.error("Finance context update error:", error);
          return Response.json({ error: "Failed to update context settings" }, { status: 500 });
        }
      }
    }

    if (body.fixed_costs?.length) {
      for (const fixedCost of body.fixed_costs) {
        const id = getString(fixedCost.id);
        if (!id) continue;

        const updates: Record<string, unknown> = {};

        if (getString(fixedCost.label) !== null) updates.label = getString(fixedCost.label);
        if (["statutory", "software", "professional", "insurance", "other"].includes(String(fixedCost.category))) {
          updates.category = fixedCost.category;
        }
        if (["italy", "sweden"].includes(String(fixedCost.framework))) {
          updates.framework = fixedCost.framework;
        }
        if (fixedCost.framework === null) {
          updates.framework = null;
        }
        if (isCurrency(fixedCost.currency)) updates.currency = fixedCost.currency;
        if (["monthly", "quarterly", "annual"].includes(String(fixedCost.cadence))) {
          updates.cadence = fixedCost.cadence;
        }
        if (getNumber(fixedCost.annual_amount) !== null) {
          updates.annual_amount = getNumber(fixedCost.annual_amount);
        }
        if (fixedCost.annual_amount === null || fixedCost.annual_amount === "") {
          updates.annual_amount = null;
        }
        if (Array.isArray(fixedCost.due_months)) {
          updates.due_months = fixedCost.due_months
            .map((value) => getNumber(value))
            .filter((value): value is number => value !== null && value >= 1 && value <= 12)
            .map((value) => Math.round(value));
        }
        if (getString(fixedCost.notes) !== null) updates.notes = getString(fixedCost.notes);
        if (fixedCost.notes === null || fixedCost.notes === "") {
          updates.notes = null;
        }
        if (getBoolean(fixedCost.already_counted_in_tax_model) !== null) {
          updates.already_counted_in_tax_model = getBoolean(
            fixedCost.already_counted_in_tax_model
          );
        }
        if (getNumber(fixedCost.sort_order) !== null) {
          updates.sort_order = getNumber(fixedCost.sort_order);
        }
        if (getBoolean(fixedCost.is_active) !== null) {
          updates.is_active = getBoolean(fixedCost.is_active);
        }

        if (Object.keys(updates).length === 0) {
          continue;
        }

        const { error } = await admin
          .from("finance_fixed_costs")
          .update(updates)
          .eq("id", id);

        if (error) {
          console.error("Finance fixed cost update error:", error);
          return Response.json({ error: "Failed to update fixed costs" }, { status: 500 });
        }
      }
    }

    const response = await buildSettingsResponse(admin);
    return Response.json({ message: "Settings updated", ...response });
  } catch (error) {
    console.error("Finance settings patch error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
