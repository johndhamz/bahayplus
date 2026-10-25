"use server";

import { revalidatePath } from "next/cache";
import * as bills from "@bahayplus/modules/bills";
import * as budgets from "@bahayplus/modules/budgets";
import type { ServiceContext } from "@bahayplus/modules/authorization";
import { fromResult, type ActionResult } from "@bahayplus/types/action-result";
import type { Result } from "@bahayplus/types/result";
import { getServiceContext } from "@/lib/auth/context";

async function run<T>(fn: (ctx: ServiceContext) => Promise<Result<T>>, message: string): Promise<ActionResult<T>> {
  const ctx = await getServiceContext();
  if (!ctx)
    return { ok: false, error: { code: "UNAUTHENTICATED", message: "Your session has ended. Please sign in again." } };
  const result = await fn(ctx);
  if (result.ok) revalidatePath("/app/h/[householdId]", "layout");
  return fromResult(result, message);
}

export const createBillAccountAction = async (i: unknown) => run((c) => bills.createBillAccount(c, i), "Bill added.");
export const updateBillAccountAction = async (i: unknown) =>
  run((c) => bills.updateBillAccount(c, i), "Account saved.");
export const archiveBillAccountAction = async (i: unknown) =>
  run((c) => bills.archiveBillAccount(c, i), "Account archived.");
export const createBillAction = async (i: unknown) => run((c) => bills.createBill(c, i), "Bill created.");
export const setBillAmountAction = async (i: unknown) => run((c) => bills.setBillAmount(c, i), "Amount saved.");
export const recordBillPaymentAction = async (i: unknown) =>
  run((c) => bills.recordBillPayment(c, i), "Payment recorded.");
export const voidBillPaymentAction = async (i: unknown) => run((c) => bills.voidBillPayment(c, i), "Payment voided.");
export const cancelBillReminderAction = async (i: unknown) =>
  run((c) => bills.cancelBillReminder(c, i), "Reminder cancelled.");

export const saveBudgetAction = async (i: unknown) => run((c) => budgets.saveBudget(c, i), "Budget saved.");
export const createExpenseAction = async (i: unknown) => run((c) => budgets.createExpense(c, i), "Expense added.");
export const voidExpenseAction = async (i: unknown) => run((c) => budgets.voidExpense(c, i), "Expense removed.");
export const createCategoryAction = async (i: unknown) => run((c) => budgets.createCategory(c, i), "Category added.");
