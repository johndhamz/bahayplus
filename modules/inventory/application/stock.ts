import { RecordStockInput } from "@bahayplus/validation/supply/supply";
import { err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";

/** Stock is an append-only ledger (`stock_movements`); on hand = sum of movements, reserved = accepted orders. */
export type InventoryRow = {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  reorderLevel: number;
  isActive: boolean;
  onHand: number;
  reserved: number;
};
export type StockMovementView = {
  id: string;
  productId: string;
  quantity: number;
  reason: string;
  note: string;
  purchaseOrderId: string | null;
  createdAt: string;
};

export async function listInventory(ctx: ServiceContext, organizationId: string): Promise<Result<InventoryRow[]>> {
  const { data, error } = await ctx.db
    .from("product_inventory")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((r) => ({
      productId: r.product_id!,
      sku: r.sku!,
      name: r.name!,
      unit: r.unit!,
      reorderLevel: Number(r.reorder_level),
      isActive: !!r.is_active,
      onHand: Number(r.on_hand),
      reserved: Number(r.reserved),
    })),
  );
}

export async function listStockMovements(
  ctx: ServiceContext,
  organizationId: string,
  productId?: string,
  limit = 50,
): Promise<Result<StockMovementView[]>> {
  let q = ctx.db
    .from("stock_movements")
    .select("id, product_id, quantity, reason, note, purchase_order_id, created_at")
    .eq("organization_id", organizationId);
  if (productId) q = q.eq("product_id", productId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((m) => ({
      id: m.id,
      productId: m.product_id,
      quantity: Number(m.quantity),
      reason: m.reason,
      note: m.note,
      purchaseOrderId: m.purchase_order_id,
      createdAt: m.created_at,
    })),
  );
}

export async function recordStockMovement(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ movementId: string }>> {
  const parsed = parseInput(RecordStockInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db.rpc("record_stock_movement", {
    p_product: v.productId,
    p_quantity: v.quantity,
    p_reason: v.reason,
    p_note: v.note,
    p_idempotency_key: v.idempotencyKey,
  });
  if (error) return err(mapDbError(error));
  return ok({ movementId: data });
}
