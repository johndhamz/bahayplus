import {
  CreateCategoryInput,
  CreateExpenseInput,
  ExpenseIdInput,
  monthStart,
  SaveBudgetInput,
} from "@bahayplus/validation/finance/budgets";
import type { PaymentMethod } from "@bahayplus/validation/finance/bills";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";
import { budgetProgress, type BudgetState } from "../domain/progress";

export type CategoryView = { id: string; name: string; isSystem: boolean };
export type BudgetRow = {
  categoryId: string;
  categoryName: string;
  limitCentavos: number | null;
  spentCentavos: number;
  state: BudgetState;
  basisPoints: number | null;
};
export type ExpenseView = {
  id: string;
  amountCentavos: number;
  spentOn: string;
  description: string;
  categoryId: string;
  categoryName: string;
  propertyId: string | null;
  paymentMethod: PaymentMethod;
  source: "manual" | "bill_payment";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listCategories(ctx: ServiceContext, householdId: string): Promise<Result<CategoryView[]>> {
  // Validated before interpolation into the PostgREST filter string.
  if (!UUID.test(householdId)) return err(appError.notFound());
  const { data, error } = await ctx.db
    .from("expense_categories")
    .select("id, name, household_id, sort_order")
    .or(`household_id.is.null,household_id.eq.${householdId}`)
    .is("archived_at", null)
    .order("sort_order")
    .order("name");
  if (error) return err(mapDbError(error));
  return ok((data ?? []).map((c) => ({ id: c.id, name: c.name, isSystem: c.household_id === null })));
}

export async function createCategory(ctx: ServiceContext, input: unknown): Promise<Result<{ categoryId: string }>> {
  const parsed = parseInput(CreateCategoryInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("expense_categories")
    .insert({ household_id: parsed.value.householdId, name: parsed.value.name, sort_order: 500 })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return err(appError.validation([{ path: ["name"], message: "That category already exists." }]));
    return err(error.code === "42501" ? appError.forbidden() : mapDbError(error));
  }
  return ok({ categoryId: data.id });
}

/** Creates or replaces the month's budget lines atomically from the caller's point of view. */
export async function saveBudget(ctx: ServiceContext, input: unknown): Promise<Result<{ budgetId: string }>> {
  const parsed = parseInput(SaveBudgetInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const month = monthStart(v.month);
  const existing = await ctx.db
    .from("budgets")
    .select("id")
    .eq("household_id", v.householdId)
    .eq("month", month)
    .maybeSingle();
  if (existing.error) return err(mapDbError(existing.error));
  let budgetId = existing.data?.id;
  if (!budgetId) {
    const created = await ctx.db.from("budgets").insert({ household_id: v.householdId, month }).select("id").single();
    if (created.error)
      return err(
        created.error.code === "42501" ? appError.forbidden("You can't edit this budget.") : mapDbError(created.error),
      );
    budgetId = created.data.id;
  }
  // Explicit diff instead of upsert: API users may only update limit_centavos (column-level grant).
  const current = await ctx.db.from("budget_lines").select("id, category_id, limit_centavos").eq("budget_id", budgetId);
  if (current.error) return err(mapDbError(current.error));
  const wanted = new Map(v.lines.map((l) => [l.categoryId, l.limitCentavos]));
  const existingLines = new Map((current.data ?? []).map((l) => [l.category_id, l]));
  const toDelete = (current.data ?? []).filter((l) => !wanted.has(l.category_id)).map((l) => l.id);
  if (toDelete.length) {
    const removed = await ctx.db.from("budget_lines").delete().in("id", toDelete);
    if (removed.error) return err(mapDbError(removed.error));
  }
  for (const [categoryId, limit] of wanted) {
    const line = existingLines.get(categoryId);
    if (line && line.limit_centavos !== limit) {
      const updated = await ctx.db.from("budget_lines").update({ limit_centavos: limit }).eq("id", line.id);
      if (updated.error) return err(mapDbError(updated.error));
    }
  }
  const toInsert = [...wanted].filter(([categoryId]) => !existingLines.has(categoryId));
  if (toInsert.length) {
    const inserted = await ctx.db
      .from("budget_lines")
      .insert(
        toInsert.map(([categoryId, limit]) => ({
          budget_id: budgetId!,
          household_id: v.householdId,
          category_id: categoryId,
          limit_centavos: limit,
        })),
      );
    if (inserted.error) return err(inserted.error.code === "42501" ? appError.forbidden() : mapDbError(inserted.error));
  }
  return ok({ budgetId });
}

export async function budgetVsActual(
  ctx: ServiceContext,
  householdId: string,
  monthKey: string,
  propertyId?: string,
): Promise<Result<BudgetRow[]>> {
  const { data, error } = await ctx.db.rpc("budget_vs_actual", {
    p_household: householdId,
    p_month: monthStart(monthKey),
    p_property: propertyId as string,
  });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((r) => {
      const progress = budgetProgress(r.limit_centavos, r.spent_centavos);
      return {
        categoryId: r.category_id,
        categoryName: r.category_name,
        limitCentavos: r.limit_centavos,
        spentCentavos: r.spent_centavos,
        state: progress.state,
        basisPoints: progress.basisPoints,
      };
    }),
  );
}

export async function monthlySpending(
  ctx: ServiceContext,
  householdId: string,
  months = 6,
  propertyId?: string,
): Promise<Result<{ month: string; spentCentavos: number }[]>> {
  const { data, error } = await ctx.db.rpc("monthly_spending", {
    p_household: householdId,
    p_months: months,
    p_property: propertyId as string,
  });
  if (error) return err(mapDbError(error));
  return ok((data ?? []).map((r) => ({ month: r.month, spentCentavos: r.spent_centavos })));
}

export async function listExpenses(
  ctx: ServiceContext,
  householdId: string,
  filter: { monthKey?: string; propertyId?: string; categoryId?: string; limit?: number } = {},
): Promise<Result<ExpenseView[]>> {
  let query = ctx.db
    .from("expenses")
    .select(
      "id, amount_centavos, spent_on, description, category_id, property_id, payment_method, source_type, expense_categories(name)",
    )
    .eq("household_id", householdId)
    .is("voided_at", null);
  if (filter.monthKey) {
    const start = monthStart(filter.monthKey);
    const [y, m] = filter.monthKey.split("-").map(Number) as [number, number];
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    query = query.gte("spent_on", start).lt("spent_on", next);
  }
  if (filter.propertyId) query = query.eq("property_id", filter.propertyId);
  if (filter.categoryId) query = query.eq("category_id", filter.categoryId);
  const { data, error } = await query
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.min(filter.limit ?? 200, 500));
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((e) => ({
      id: e.id,
      amountCentavos: e.amount_centavos,
      spentOn: e.spent_on,
      description: e.description,
      categoryId: e.category_id,
      categoryName: (e.expense_categories as { name: string } | null)?.name ?? "Other",
      propertyId: e.property_id,
      paymentMethod: e.payment_method as PaymentMethod,
      source: e.source_type as ExpenseView["source"],
    })),
  );
}

export async function createExpense(ctx: ServiceContext, input: unknown): Promise<Result<{ expenseId: string }>> {
  const parsed = parseInput(CreateExpenseInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db
    .from("expenses")
    .insert({
      household_id: v.householdId,
      property_id: v.propertyId,
      category_id: v.categoryId,
      amount_centavos: v.amountCentavos,
      spent_on: v.spentOn,
      description: v.description,
      payment_method: v.paymentMethod,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23503")
      return err(appError.validation([{ path: ["propertyId"], message: "Choose a property from this household." }]));
    return err(
      error.code === "42501" ? appError.forbidden("You can't record expenses for this household.") : mapDbError(error),
    );
  }
  return ok({ expenseId: data.id });
}

/** Only manual expenses can be voided here; bill-payment expenses follow their payment. */
export async function voidExpense(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(ExpenseIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("expenses")
    .update({ voided_at: new Date().toISOString() })
    .eq("id", parsed.value.expenseId)
    .eq("source_type", "manual")
    .is("voided_at", null)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length)
    return err(
      appError.forbidden(
        "This expense can't be removed here. Bill payment expenses are removed by voiding the payment.",
      ),
    );
  return ok(true);
}
