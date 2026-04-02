import { NextRequest } from "next/server";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getPreviousMonthKey,
  filterProjectsForMonth,
  buildProjectsWithPayments,
  buildInvoiceReminders,
  buildFixedCostSummary,
  buildKeepSummary,
  buildMonthlyContextPayouts,
  buildMonthlyTrend,
  buildVariableExpenseSummary,
  buildWeeklySummary,
  buildTaxSummary,
  getNetTotalsByCurrency,
  getFeeTotalsByCurrency,
  getFeeTotalsByContext,
  resolveExchangeRates,
  getApproxTotal,
  buildComparison,
  normalizeMonthKey,
} from "@/lib/finance/reporting";
import {
  DEFAULT_CARD_PROCESSOR_FEE_PERCENTAGE,
  getContextCurrencyDefault,
  getContextFeeDefault,
  paymentMethodNeedsInvoiceByDefault,
} from "@/lib/finance/config";
import type {
  BookingRow,
  FinancePaymentInsert,
  FinancePaymentMethod,
  FinanceProjectInsert,
  FinanceSettingsRow,
  FinanceVariableExpenseInsert,
  FinanceWorkContext,
} from "@/lib/supabase/database.types";
import type {
  FinanceBookingOption,
  FinanceDashboardResponse,
  FinanceProjectWithPayments,
} from "@/lib/finance/types";

export const dynamic = "force-dynamic";

async function requireAuth() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

async function loadFinanceBase(admin = createAdminClient()) {
  const [
    contextResult,
    settingsResult,
    fixedCostsResult,
    variableExpensesResult,
    projectsResult,
    paymentsResult,
    bookingsResult,
  ] = await Promise.all([
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
    admin
      .from("finance_variable_expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false }),
    admin
      .from("finance_projects")
      .select("*")
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false }),
    admin
      .from("finance_payments")
      .select("*")
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false }),
    admin
      .from("bookings")
      .select(
        "id, client_name, deposit_amount, location, type, status, appointment_date, preferred_dates"
      )
      .order("created_at", { ascending: false }),
  ]);

  if (contextResult.error) throw contextResult.error;
  if (settingsResult.error) throw settingsResult.error;
  if (fixedCostsResult.error) throw fixedCostsResult.error;
  if (variableExpensesResult.error) throw variableExpensesResult.error;
  if (projectsResult.error) throw projectsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (bookingsResult.error) throw bookingsResult.error;

  return {
    contextSettings: contextResult.data ?? [],
    settings: settingsResult.data as FinanceSettingsRow,
    fixedCosts: fixedCostsResult.data ?? [],
    variableExpenses: variableExpensesResult.data ?? [],
    projects: projectsResult.data ?? [],
    payments: paymentsResult.data ?? [],
    bookings: (bookingsResult.data ?? []) as Pick<
      BookingRow,
      | "id"
      | "client_name"
      | "deposit_amount"
      | "location"
      | "type"
      | "status"
      | "appointment_date"
      | "preferred_dates"
    >[],
  };
}

function buildBookingOptions(
  bookings: Pick<
    BookingRow,
    | "id"
    | "client_name"
    | "deposit_amount"
    | "location"
    | "type"
    | "status"
    | "appointment_date"
    | "preferred_dates"
  >[],
  projects: FinanceProjectWithPayments[]
): FinanceBookingOption[] {
  const linkedBookingIds = new Set(
    projects.map((project) => project.booking_id).filter(Boolean)
  );

  return bookings.map((booking) => ({
    ...booking,
    is_linked: linkedBookingIds.has(booking.id),
  }));
}

async function buildDashboardResponse(monthKey: string): Promise<FinanceDashboardResponse> {
  const admin = createAdminClient();
  const {
    contextSettings,
    settings,
    fixedCosts,
    variableExpenses,
    projects,
    payments,
    bookings,
  } = await loadFinanceBase(admin);
  const rates = await resolveExchangeRates(settings);

  const projectsWithPayments = buildProjectsWithPayments(projects, payments, rates);
  const monthlyProjects = filterProjectsForMonth(projectsWithPayments, monthKey);
  const monthlyPayments = monthlyProjects.flatMap((project) =>
    project.payments.filter((payment) => payment.payment_date.startsWith(monthKey))
  );
  const invoiceReminders = buildInvoiceReminders(monthlyProjects);
  const netTotals = getNetTotalsByCurrency(monthlyPayments, "reporting_currency");
  const feeTotals = getFeeTotalsByCurrency(
    monthlyPayments,
    "reporting_currency",
    "fee_amount"
  );
  const processorFeeTotals = getFeeTotalsByCurrency(
    monthlyPayments,
    "processor_fee_currency",
    "processor_fee_amount"
  );
  const processorFeeApproxTotals = getFeeTotalsByCurrency(
    monthlyPayments,
    "reporting_currency",
    "processor_fee_amount_reporting"
  );
  const feeTotalsByContext = getFeeTotalsByContext(monthlyProjects, monthKey);
  const weekly = buildWeeklySummary(
    monthlyPayments,
    settings.reporting_currency_primary,
    rates
  );
  const monthlyTrend = buildMonthlyTrend(
    projectsWithPayments,
    rates,
    settings.reporting_currency_primary
  );
  const monthlyContextPayouts = buildMonthlyContextPayouts(projectsWithPayments);
  const approxPrimaryAmount = getApproxTotal(
    monthlyPayments,
    settings.reporting_currency_primary,
    rates
  );
  const approxSecondaryAmount = getApproxTotal(
    monthlyPayments,
    settings.reporting_currency_secondary,
    rates
  );
  const fixedCostsSummary = buildFixedCostSummary(
    fixedCosts,
    settings.reporting_currency_primary,
    rates,
    monthKey
  );
  const variableExpensesSummary = buildVariableExpenseSummary(
    variableExpenses,
    settings.reporting_currency_primary,
    rates,
    monthKey
  );
  const keepSummary = buildKeepSummary(
    projectsWithPayments,
    settings,
    fixedCosts,
    variableExpenses,
    rates,
    monthKey
  );
  const taxSummary = buildTaxSummary(projectsWithPayments, settings, rates, monthKey);

  const previousMonth = getPreviousMonthKey(monthKey);
  const previousProjects = filterProjectsForMonth(projectsWithPayments, previousMonth);
  const previousPayments = previousProjects.flatMap((project) =>
    project.payments.filter((payment) => payment.payment_date.startsWith(previousMonth))
  );
  const previousPrimaryAmount = getApproxTotal(
    previousPayments,
    settings.reporting_currency_primary,
    rates
  );

  return {
    month: monthKey,
    summary: {
      month: monthKey,
      entry_count: monthlyPayments.length,
      month_total: approxPrimaryAmount,
      week_total: weekly.at(-1)?.net_total ?? 0,
      open_invoice_count: invoiceReminders.length,
      net_totals_by_reporting_currency: netTotals,
      studio_fee_totals_by_reporting_currency: feeTotals,
      processor_fee_totals_by_processor_currency: processorFeeTotals,
      processor_fee_approx_totals_by_reporting_currency: processorFeeApproxTotals,
      fee_totals_by_context: feeTotalsByContext,
      approx_primary: {
        currency: settings.reporting_currency_primary,
        amount: approxPrimaryAmount,
        source: rates.source,
      },
      approx_secondary: {
        currency: settings.reporting_currency_secondary,
        amount: approxSecondaryAmount,
        source: rates.source,
      },
      comparison: buildComparison(
        approxPrimaryAmount,
        previousPrimaryAmount,
        previousMonth
      ),
      weekly,
      monthly_trend: monthlyTrend,
      monthly_context_payouts: monthlyContextPayouts,
      fixed_costs: fixedCostsSummary,
      variable_expenses: variableExpensesSummary,
      keep_summary: keepSummary,
      tax_summary: taxSummary,
    },
    context_settings: contextSettings,
    settings,
    fixed_costs: fixedCosts,
    variable_expenses: variableExpenses,
    bookings: buildBookingOptions(bookings, projectsWithPayments),
    projects: monthlyProjects,
    invoice_reminders: invoiceReminders,
  };
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

function isFinanceWorkContext(value: unknown): value is FinanceWorkContext {
  return [
    "malmo_studio",
    "copenhagen_studio",
    "guest_spot",
    "private_home",
  ].includes(String(value));
}

function isPaymentMethod(value: unknown): value is FinancePaymentMethod {
  return ["cash", "card", "bank_transfer", "paypal", "revolut", "swish"].includes(
    String(value)
  );
}

function isCurrency(value: unknown): value is FinancePaymentInsert["currency"] {
  return ["SEK", "DKK", "EUR"].includes(String(value));
}

export async function GET(request: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const monthKey = normalizeMonthKey(request.nextUrl.searchParams.get("month"));
    const response = await buildDashboardResponse(monthKey);
    return Response.json(response);
  } catch (error) {
    console.error("Finance dashboard fetch error:", error);
    return Response.json({ error: "Failed to load finance dashboard" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const admin = createAdminClient();
    const entryType = getString(body.entry_type) ?? "payment";

    if (entryType === "variable_expense") {
      const expenseDate = getString(body.expense_date);
      const label = getString(body.label);
      const category = getString(body.category);
      const amount = getNumber(body.amount);

      if (!expenseDate || !label || !category || amount === null) {
        return Response.json(
          { error: "Expense date, label, category, and amount are required" },
          { status: 400 }
        );
      }

      if (!["needles", "ink", "supplies", "equipment", "travel", "other"].includes(category)) {
        return Response.json({ error: "Invalid expense category" }, { status: 400 });
      }

      const { settings } = await loadFinanceBase(admin);
      const expenseInsert: FinanceVariableExpenseInsert = {
        expense_date: expenseDate,
        label,
        category: category as FinanceVariableExpenseInsert["category"],
        amount,
        currency: isCurrency(body.currency) ? body.currency : settings.reporting_currency_primary,
        notes: getString(body.notes),
      };

      const { error: expenseError } = await admin
        .from("finance_variable_expenses")
        .insert(expenseInsert);

      if (expenseError) {
        console.error("Finance variable expense create error:", expenseError);
        return Response.json({ error: "Failed to create expense" }, { status: 500 });
      }

      const monthKey = normalizeMonthKey(expenseDate.slice(0, 7));
      const response = await buildDashboardResponse(monthKey);
      return Response.json({ message: "Expense created", ...response });
    }

    const clientName = getString(body.client_name);
    const projectLabel = getString(body.project_label);
    const workContext = body.work_context;
    const paymentDate = getString(body.payment_date);
    const grossAmount = getNumber(body.gross_amount);
    const paymentMethod = body.payment_method;

    if (!isFinanceWorkContext(workContext)) {
      return Response.json(
        { error: "Work context is required" },
        { status: 400 }
      );
    }

    if (!paymentDate || grossAmount === null || !isPaymentMethod(paymentMethod)) {
      return Response.json(
        { error: "Payment date, amount, and payment method are required" },
        { status: 400 }
      );
    }

    const { contextSettings, settings } = await loadFinanceBase(admin);
    const currency = isCurrency(body.currency)
      ? body.currency
      : getContextCurrencyDefault(workContext, contextSettings);
    const feePercentage =
      getNumber(body.fee_percentage) ??
      getContextFeeDefault(workContext, contextSettings);
    const reportingCurrency = isCurrency(body.reporting_currency)
      ? body.reporting_currency
      : getContextCurrencyDefault(workContext, contextSettings);
    const processorFeePercentage =
      getNumber(body.processor_fee_percentage) ??
      (paymentMethod === "card"
        ? settings.card_processor_fee_percentage ??
          DEFAULT_CARD_PROCESSOR_FEE_PERCENTAGE
        : 0);
    const invoiceNeeded =
      getBoolean(body.invoice_needed) ??
      (settings.card_invoice_default
        ? paymentMethodNeedsInvoiceByDefault(paymentMethod)
        : false);
    const invoiceDone = getBoolean(body.invoice_done) ?? false;

    const projectInsert: FinanceProjectInsert = {
      booking_id: getString(body.booking_id),
      client_name: clientName ?? "Walk-in / direct client",
      project_label: projectLabel ?? "Tattoo session",
      session_date: getString(body.session_date),
      work_context: workContext,
      context_label: getString(body.context_label),
      notes: getString(body.project_notes),
    };

    const { data: createdProject, error: projectError } = await admin
      .from("finance_projects")
      .insert(projectInsert)
      .select()
      .single();

    if (projectError || !createdProject) {
      console.error("Finance project create error:", projectError);
      return Response.json({ error: "Failed to create project" }, { status: 500 });
    }

    const paymentInsert: FinancePaymentInsert = {
      project_id: createdProject.id,
      payment_label: getString(body.payment_label) ?? "session payment",
      payment_date: paymentDate,
      gross_amount: grossAmount,
      currency,
      reporting_currency: reportingCurrency,
      payment_method: paymentMethod,
      fee_percentage: feePercentage,
      studio_fee_base_amount: getNumber(body.studio_fee_base_amount),
      studio_fee_base_currency: isCurrency(body.studio_fee_base_currency)
        ? body.studio_fee_base_currency
        : null,
      processor_fee_percentage: processorFeePercentage,
      invoice_needed: invoiceNeeded,
      invoice_done: invoiceDone,
      invoice_reference: getString(body.invoice_reference),
      notes: getString(body.payment_notes),
    };

    const { error: paymentError } = await admin
      .from("finance_payments")
      .insert(paymentInsert);

    if (paymentError) {
      console.error("Finance payment create error:", paymentError);
      await admin.from("finance_projects").delete().eq("id", createdProject.id);
      return Response.json({ error: "Failed to create payment" }, { status: 500 });
    }

    const monthKey = normalizeMonthKey(paymentDate.slice(0, 7));
    const response = await buildDashboardResponse(monthKey);
    return Response.json({ message: "Finance entry created", ...response });
  } catch (error) {
    console.error("Finance create error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = getString(body.id);
    const entryType = getString(body.entry_type) ?? "payment";

    if (!id) {
      return Response.json({ error: "Payment ID is required" }, { status: 400 });
    }

    if (entryType === "variable_expense") {
      const action = getString(body.action) ?? "update";
      const admin = createAdminClient();

      if (action === "delete") {
        const { data: existingExpense, error: existingExpenseError } = await admin
          .from("finance_variable_expenses")
          .select("expense_date")
          .eq("id", id)
          .single();

        if (existingExpenseError || !existingExpense) {
          return Response.json({ error: "Expense not found" }, { status: 404 });
        }

        const { error: deleteError } = await admin
          .from("finance_variable_expenses")
          .delete()
          .eq("id", id);

        if (deleteError) {
          console.error("Finance variable expense delete error:", deleteError);
          return Response.json({ error: "Failed to delete expense" }, { status: 500 });
        }

        const monthKey = normalizeMonthKey(existingExpense.expense_date.slice(0, 7));
        const response = await buildDashboardResponse(monthKey);
        return Response.json({ message: "Expense deleted", ...response });
      }
    }

    const updates: Record<string, unknown> = {};
    if (getString(body.payment_label) !== null) updates.payment_label = getString(body.payment_label);
    if (getString(body.payment_date) !== null) updates.payment_date = getString(body.payment_date);
    if (getNumber(body.gross_amount) !== null) updates.gross_amount = getNumber(body.gross_amount);
    if (isCurrency(body.currency)) updates.currency = body.currency;
    if (isCurrency(body.reporting_currency)) updates.reporting_currency = body.reporting_currency;
    if (isPaymentMethod(body.payment_method)) updates.payment_method = body.payment_method;
    if (getNumber(body.fee_percentage) !== null) updates.fee_percentage = getNumber(body.fee_percentage);
    if (getNumber(body.processor_fee_percentage) !== null) {
      updates.processor_fee_percentage = getNumber(body.processor_fee_percentage);
    }
    if (getBoolean(body.invoice_needed) !== null) updates.invoice_needed = getBoolean(body.invoice_needed);
    if (getBoolean(body.invoice_done) !== null) updates.invoice_done = getBoolean(body.invoice_done);
    if (body.invoice_last_nudged_at !== undefined) {
      updates.invoice_last_nudged_at = getString(body.invoice_last_nudged_at);
    }
    if (body.invoice_reminder_note !== undefined) {
      updates.invoice_reminder_note = getString(body.invoice_reminder_note);
    }
    if (body.invoice_reference !== undefined) updates.invoice_reference = getString(body.invoice_reference);
    if (body.notes !== undefined) updates.notes = getString(body.notes);

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: updatedPayment, error } = await admin
      .from("finance_payments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !updatedPayment) {
      console.error("Finance payment update error:", error);
      return Response.json({ error: "Failed to update payment" }, { status: 500 });
    }

    const monthKey = normalizeMonthKey(updatedPayment.payment_date.slice(0, 7));
    const response = await buildDashboardResponse(monthKey);
    return Response.json({ message: "Payment updated", ...response });
  } catch (error) {
    console.error("Finance patch error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
