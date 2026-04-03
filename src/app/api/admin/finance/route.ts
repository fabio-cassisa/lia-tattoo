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
  const approxPrimary = getApproxTotal(
    monthlyPayments,
    settings.reporting_currency_primary,
    rates
  );
  const approxSecondary = getApproxTotal(
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
  const previousPrimary = getApproxTotal(
    previousPayments,
    settings.reporting_currency_primary,
    rates
  );

  return {
    month: monthKey,
    summary: {
      month: monthKey,
      entry_count: monthlyPayments.length,
      month_total: approxPrimary.amount,
      week_total: weekly.at(-1)?.net_total ?? 0,
      open_invoice_count: invoiceReminders.length,
      net_totals_by_reporting_currency: netTotals,
      studio_fee_totals_by_reporting_currency: feeTotals,
      processor_fee_totals_by_processor_currency: processorFeeTotals,
      processor_fee_approx_totals_by_reporting_currency: processorFeeApproxTotals,
      fee_totals_by_context: feeTotalsByContext,
      approx_primary: {
        currency: settings.reporting_currency_primary,
        amount: approxPrimary.amount,
        source: approxPrimary.source,
      },
      approx_secondary: {
        currency: settings.reporting_currency_secondary,
        amount: approxSecondary.amount,
        source: approxSecondary.source,
      },
      comparison: buildComparison(
        approxPrimary.amount,
        previousPrimary.amount,
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
  if (typeof value === "string" && value.trim().length === 0) return null;
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

function buildPaymentFxSnapshot(rates: Awaited<ReturnType<typeof resolveExchangeRates>>) {
  return {
    fx_eur_to_sek: rates.eur_to_sek,
    fx_eur_to_dkk: rates.eur_to_dkk,
    fx_source: rates.source,
  } as const;
}

function shouldRefreshPaymentFxSnapshot(paymentUpdates: Record<string, unknown>): boolean {
  return [
    "gross_amount",
    "currency",
    "reporting_currency",
    "payment_method",
    "fee_percentage",
    "studio_fee_base_amount",
    "studio_fee_base_currency",
    "processor_fee_percentage",
  ].some((key) => Object.prototype.hasOwnProperty.call(paymentUpdates, key));
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
    const rates = await resolveExchangeRates(settings);
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
    const invoiceDone = getBoolean(body.invoice_done) ?? false;
    const invoiceNeeded =
      invoiceDone ||
      getBoolean(body.invoice_needed) ||
      (settings.card_invoice_default
        ? paymentMethodNeedsInvoiceByDefault(paymentMethod)
        : false);
    const studioFeeBaseAmount = getNumber(body.studio_fee_base_amount);
    const studioFeeBaseCurrency =
      studioFeeBaseAmount !== null && isCurrency(body.studio_fee_base_currency)
        ? body.studio_fee_base_currency
        : null;

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
      studio_fee_base_amount: studioFeeBaseAmount,
      studio_fee_base_currency: studioFeeBaseCurrency,
      processor_fee_percentage: processorFeePercentage,
      invoice_needed: invoiceNeeded,
      invoice_done: invoiceDone,
      invoice_reference: getString(body.invoice_reference),
      notes: getString(body.payment_notes),
      ...buildPaymentFxSnapshot(rates),
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

      if (![
        "needles",
        "ink",
        "supplies",
        "equipment",
        "travel",
        "other",
      ].includes(category)) {
        return Response.json({ error: "Invalid expense category" }, { status: 400 });
      }

      const { settings } = await loadFinanceBase(admin);
      const { data: updatedExpense, error: updateError } = await admin
        .from("finance_variable_expenses")
        .update({
          expense_date: expenseDate,
          label,
          category: category as FinanceVariableExpenseInsert["category"],
          amount,
          currency: isCurrency(body.currency)
            ? body.currency
            : settings.reporting_currency_primary,
          notes: getString(body.notes),
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError || !updatedExpense) {
        console.error("Finance variable expense update error:", updateError);
        return Response.json({ error: "Failed to update expense" }, { status: 500 });
      }

      const monthKey = normalizeMonthKey(updatedExpense.expense_date.slice(0, 7));
      const response = await buildDashboardResponse(monthKey);
      return Response.json({ message: "Expense updated", ...response });
    }

    const admin = createAdminClient();
    const action = getString(body.action) ?? "update";
    const { settings } = await loadFinanceBase(admin);
    const { data: existingPayment, error: existingPaymentError } = await admin
      .from("finance_payments")
      .select(
        "id, payment_date, project_id, currency, reporting_currency, payment_method, fee_percentage, studio_fee_base_amount, studio_fee_base_currency, processor_fee_percentage, invoice_needed, invoice_done"
      )
      .eq("id", id)
      .single();

    if (existingPaymentError || !existingPayment) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    if (action === "delete") {
      const { error: deletePaymentError } = await admin
        .from("finance_payments")
        .delete()
        .eq("id", id);

      if (deletePaymentError) {
        console.error("Finance payment delete error:", deletePaymentError);
        return Response.json({ error: "Failed to delete payment" }, { status: 500 });
      }

      const { count: remainingPaymentCount, error: remainingPaymentCountError } = await admin
        .from("finance_payments")
        .select("id", { count: "exact", head: true })
        .eq("project_id", existingPayment.project_id);

      if (remainingPaymentCountError) {
        console.error("Finance remaining payment count error:", remainingPaymentCountError);
        return Response.json({ error: "Failed to refresh finance entry state" }, { status: 500 });
      }

      if ((remainingPaymentCount ?? 0) === 0) {
        const { error: deleteProjectError } = await admin
          .from("finance_projects")
          .delete()
          .eq("id", existingPayment.project_id);

        if (deleteProjectError) {
          console.error("Finance project delete error:", deleteProjectError);
          return Response.json({ error: "Failed to delete empty project" }, { status: 500 });
        }
      }

      const monthKey = normalizeMonthKey(existingPayment.payment_date.slice(0, 7));
      const response = await buildDashboardResponse(monthKey);
      return Response.json({ message: "Finance entry deleted", ...response });
    }

    const paymentUpdates: Record<string, unknown> = {};
    const projectUpdates: Record<string, unknown> = {};
    const projectId = getString(body.project_id) ?? existingPayment.project_id;

    if (body.booking_id !== undefined) projectUpdates.booking_id = getString(body.booking_id);
    if (body.client_name !== undefined) {
      projectUpdates.client_name = getString(body.client_name) ?? "Walk-in / direct client";
    }
    if (body.project_label !== undefined) {
      projectUpdates.project_label = getString(body.project_label) ?? "Tattoo session";
    }
    if (body.session_date !== undefined) projectUpdates.session_date = getString(body.session_date);
    if (isFinanceWorkContext(body.work_context)) projectUpdates.work_context = body.work_context;
    if (body.project_notes !== undefined) projectUpdates.notes = getString(body.project_notes);

    if (getString(body.payment_label) !== null) paymentUpdates.payment_label = getString(body.payment_label);
    if (getString(body.payment_date) !== null) paymentUpdates.payment_date = getString(body.payment_date);
    if (getNumber(body.gross_amount) !== null) paymentUpdates.gross_amount = getNumber(body.gross_amount);
    if (isCurrency(body.currency)) paymentUpdates.currency = body.currency;
    if (isCurrency(body.reporting_currency)) paymentUpdates.reporting_currency = body.reporting_currency;
    if (isPaymentMethod(body.payment_method)) paymentUpdates.payment_method = body.payment_method;
    if (getNumber(body.fee_percentage) !== null) paymentUpdates.fee_percentage = getNumber(body.fee_percentage);
    if (body.studio_fee_base_amount !== undefined) {
      paymentUpdates.studio_fee_base_amount = getNumber(body.studio_fee_base_amount);
    }
    if (body.studio_fee_base_currency !== undefined) {
      paymentUpdates.studio_fee_base_currency = isCurrency(body.studio_fee_base_currency)
        ? body.studio_fee_base_currency
        : null;
    }
    if (getNumber(body.processor_fee_percentage) !== null) {
      paymentUpdates.processor_fee_percentage = getNumber(body.processor_fee_percentage);
    }
    if (getBoolean(body.invoice_needed) !== null) {
      paymentUpdates.invoice_needed = getBoolean(body.invoice_needed);
    }
    if (getBoolean(body.invoice_done) !== null) {
      paymentUpdates.invoice_done = getBoolean(body.invoice_done);
    }

    if (paymentUpdates.invoice_done === true) {
      paymentUpdates.invoice_needed = true;
    }
    if (paymentUpdates.invoice_needed === false) {
      paymentUpdates.invoice_done = false;
    }
    if (paymentUpdates.studio_fee_base_amount === null) {
      paymentUpdates.studio_fee_base_currency = null;
    }
    if (body.invoice_last_nudged_at !== undefined) {
      paymentUpdates.invoice_last_nudged_at = getString(body.invoice_last_nudged_at);
    }
    if (body.invoice_reminder_note !== undefined) {
      paymentUpdates.invoice_reminder_note = getString(body.invoice_reminder_note);
    }
    if (body.invoice_reference !== undefined) {
      paymentUpdates.invoice_reference = getString(body.invoice_reference);
    }
    if (body.payment_notes !== undefined || body.notes !== undefined) {
      paymentUpdates.notes = getString(body.payment_notes ?? body.notes);
    }

    if (Object.keys(paymentUpdates).length === 0 && Object.keys(projectUpdates).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    if (shouldRefreshPaymentFxSnapshot(paymentUpdates)) {
      const rates = await resolveExchangeRates(settings);
      Object.assign(paymentUpdates, buildPaymentFxSnapshot(rates));
    }

    if (Object.keys(projectUpdates).length > 0) {
      const { error: projectUpdateError } = await admin
        .from("finance_projects")
        .update(projectUpdates)
        .eq("id", projectId);

      if (projectUpdateError) {
        console.error("Finance project update error:", projectUpdateError);
        return Response.json({ error: "Failed to update project" }, { status: 500 });
      }
    }

    let monthKey = normalizeMonthKey(existingPayment.payment_date.slice(0, 7));

    if (Object.keys(paymentUpdates).length > 0) {
      const { data: updatedPayment, error: paymentUpdateError } = await admin
        .from("finance_payments")
        .update(paymentUpdates)
        .eq("id", id)
        .select()
        .single();

      if (paymentUpdateError || !updatedPayment) {
        console.error("Finance payment update error:", paymentUpdateError);
        return Response.json({ error: "Failed to update payment" }, { status: 500 });
      }

      monthKey = normalizeMonthKey(updatedPayment.payment_date.slice(0, 7));
    }

    const response = await buildDashboardResponse(monthKey);
    return Response.json({ message: "Finance entry updated", ...response });
  } catch (error) {
    console.error("Finance patch error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
