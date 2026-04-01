import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  FinanceCurrency,
  FinanceSettingsRow,
  FinanceWorkContext,
} from "@/lib/supabase/database.types";
import type { FinanceSettingsResponse } from "@/lib/finance/types";

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
  const [contextResult, settingsResult] = await Promise.all([
    admin
      .from("finance_context_settings")
      .select("*")
      .order("sort_order", { ascending: true }),
    admin.from("finance_settings").select("*").eq("scope", "default").single(),
  ]);

  if (contextResult.error) throw contextResult.error;
  if (settingsResult.error) throw settingsResult.error;

  return {
    context_settings: contextResult.data ?? [],
    settings: settingsResult.data as FinanceSettingsRow,
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

    const response = await buildSettingsResponse(admin);
    return Response.json({ message: "Settings updated", ...response });
  } catch (error) {
    console.error("Finance settings patch error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
