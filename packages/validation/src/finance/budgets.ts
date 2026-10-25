import { z } from "zod";
import { Uuid } from "../common/primitives";
import { OptionalPesoAmount, RequiredIsoDate, text } from "../common/fields";
import { PaymentMethod } from "./bills";
import { parsePesoInput } from "@bahayplus/types/money";

export const MonthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month.");
export const monthStart = (key: string) => `${key}-01`;

const OptionalUuid = z
  .union([Uuid, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

export const SaveBudgetInput = z.object({
  householdId: Uuid,
  month: MonthKey,
  lines: z
    .array(z.object({ categoryId: Uuid, limitCentavos: OptionalPesoAmount }))
    .max(50)
    .transform((lines) =>
      lines.filter((l): l is { categoryId: string; limitCentavos: number } => l.limitCentavos !== null),
    ),
});
export type SaveBudgetInput = z.input<typeof SaveBudgetInput>;

export const CreateExpenseInput = z.object({
  householdId: Uuid,
  propertyId: OptionalUuid,
  categoryId: Uuid,
  amountCentavos: z.union([z.string(), z.number()]).transform((v, ctx) => {
    const c = typeof v === "number" ? v : (parsePesoInput(v)?.amountCentavos ?? Number.NaN);
    if (!Number.isSafeInteger(c) || c <= 0) {
      ctx.addIssue({ code: "custom", message: "Enter an amount greater than zero." });
      return z.NEVER;
    }
    return c;
  }),
  spentOn: RequiredIsoDate,
  description: text(200),
  paymentMethod: PaymentMethod.default("cash"),
});
export type CreateExpenseInput = z.input<typeof CreateExpenseInput>;

export const ExpenseIdInput = z.object({ expenseId: Uuid });

export const CreateCategoryInput = z.object({
  householdId: Uuid,
  name: z.string().trim().min(1, "Name the category.").max(60),
});
