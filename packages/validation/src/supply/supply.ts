import { z } from "zod";
import { parsePesoInput } from "@bahayplus/types/money";
import { Uuid } from "../common/primitives";
import { OptionalIsoDate, text } from "../common/fields";

const Peso = (label: string) =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const c = typeof v === "number" ? v : (parsePesoInput(v)?.amountCentavos ?? Number.NaN);
    if (!Number.isSafeInteger(c) || c < 0) {
      ctx.addIssue({ code: "custom", message: `Enter ${label} in pesos.` });
      return z.NEVER;
    }
    return c;
  });

/** Up to 3 decimals (e.g. 2.5 m of wire), positive. */
export const Quantity = (allowNegative = false) =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const n = typeof v === "number" ? v : Number(String(v).replaceAll(",", "").trim());
    const ok =
      Number.isFinite(n) &&
      n !== 0 &&
      Math.abs(n) <= 1_000_000 &&
      Math.round(n * 1000) === n * 1000 &&
      (allowNegative || n > 0);
    if (!ok) {
      ctx.addIssue({
        code: "custom",
        message: allowNegative
          ? "Enter a non-zero quantity (use − to remove stock)."
          : "Enter a quantity greater than 0.",
      });
      return z.NEVER;
    }
    return n;
  });

export const UpdateSupplierProfileInput = z.object({
  organizationId: Uuid,
  description: text(2000),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?[0-9 ()-]{7,20})?$/, "Enter a valid phone number.")
    .default(""),
  email: z.union([z.email({ message: "Enter a valid email." }), z.literal("")]).default(""),
  address: text(300),
  deliveryAreas: text(500),
  minOrderCentavos: Peso("a minimum order"),
  isPublished: z.boolean().default(false),
});
export type UpdateSupplierProfileInput = z.input<typeof UpdateSupplierProfileInput>;

const ProductFields = z.object({
  sku: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]{1,40}$/, "Use letters, numbers, dots, dashes or underscores (max 40)."),
  name: z.string().trim().min(2, "Name the product.").max(120),
  description: text(1000),
  category: text(60),
  unit: z.string().trim().min(1, "Enter a unit, e.g. pc, box, bag.").max(20),
  unitPriceCentavos: Peso("a price"),
  reorderLevel: z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      const n = typeof v === "number" ? v : Number(String(v || "0").replaceAll(",", ""));
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: "Enter 0 or more." });
        return z.NEVER;
      }
      return n;
    })
    .default(0),
  isActive: z.boolean().default(true),
});
export const CreateProductInput = ProductFields.extend({ organizationId: Uuid });
export type CreateProductInput = z.input<typeof CreateProductInput>;
export const UpdateProductInput = ProductFields.extend({ productId: Uuid });
export type UpdateProductInput = z.input<typeof UpdateProductInput>;

export const STOCK_REASONS = ["receipt", "adjustment", "return"] as const;
export const RecordStockInput = z.object({
  productId: Uuid,
  quantity: Quantity(true),
  reason: z.enum(STOCK_REASONS),
  note: text(300),
  idempotencyKey: z.string().min(8).max(120),
});
export type RecordStockInput = z.input<typeof RecordStockInput>;

export const CreatePurchaseOrderInput = z.object({
  buyerOrgId: Uuid,
  supplierOrgId: Uuid,
  lines: z
    .array(z.object({ productId: Uuid, quantity: Quantity() }))
    .min(1, "Add at least one product.")
    .max(50)
    .refine((ls) => new Set(ls.map((l) => l.productId)).size === ls.length, "Each product can appear once."),
  deliveryAddress: z.string().trim().min(5, "Enter the delivery address.").max(300),
  deliveryContact: text(120),
  requestedDeliveryOn: OptionalIsoDate,
  buyerNotes: text(1000),
  idempotencyKey: z.string().min(8).max(120),
});
export type CreatePurchaseOrderInput = z.input<typeof CreatePurchaseOrderInput>;

export const DecidePurchaseOrderInput = z.object({
  purchaseOrderId: Uuid,
  decision: z.enum(["accepted", "rejected"]),
  note: text(1000),
});
export const ShipPurchaseOrderInput = z.object({
  purchaseOrderId: Uuid,
  courier: text(80),
  trackingRef: text(80),
  scheduledFor: OptionalIsoDate,
});
export type ShipPurchaseOrderInput = z.input<typeof ShipPurchaseOrderInput>;
export const UpdateDeliveryInput = z.object({
  purchaseOrderId: Uuid,
  status: z.enum(["delivered", "failed", "out_for_delivery"]),
  detail: text(300),
});
export const CancelPurchaseOrderInput = z.object({
  purchaseOrderId: Uuid,
  reason: z.string().trim().min(3, "Give a reason.").max(500),
});

export const PO_STATUSES = ["submitted", "accepted", "rejected", "shipped", "delivered", "cancelled"] as const;
export type PurchaseOrderStatus = (typeof PO_STATUSES)[number];
