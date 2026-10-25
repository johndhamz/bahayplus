import { z } from "zod";
import { isIsoDate } from "@bahayplus/types/dates";
import { parsePesoInput } from "@bahayplus/types/money";

/** Optional calendar date from a form: "" → null, otherwise a valid YYYY-MM-DD (Asia/Manila calendar date). */
export const OptionalIsoDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v.trim() === "") return null;
    if (!isIsoDate(v.trim())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return v.trim();
  });

export const RequiredIsoDate = z
  .string()
  .trim()
  .refine((v) => isIsoDate(v), "Enter a valid date.");

/**
 * Optional peso amount typed by a user ("1,250.50", "₱99") → integer centavos, never a float.
 * Accepts numbers of centavos from API clients.
 */
export const OptionalPesoAmount = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
    if (typeof v === "number") {
      if (!Number.isSafeInteger(v) || v < 0) {
        ctx.addIssue({ code: "custom", message: "Amount must be whole centavos." });
        return z.NEVER;
      }
      return v;
    }
    const money = parsePesoInput(v);
    if (!money || money.amountCentavos < 0) {
      ctx.addIssue({ code: "custom", message: "Enter an amount in pesos, e.g. 1,250.50" });
      return z.NEVER;
    }
    return money.amountCentavos;
  });

export const OptionalInt = (min: number, max: number, label: string) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v, ctx) => {
      if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
      const n = typeof v === "number" ? v : Number(v.replaceAll(",", ""));
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number from ${min} to ${max}.` });
        return z.NEVER;
      }
      return n;
    });

export const text = (max: number) => z.string().trim().max(max, `Use ${max} characters or fewer.`).default("");
