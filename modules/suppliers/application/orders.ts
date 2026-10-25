import {
  CancelPurchaseOrderInput,
  CreatePurchaseOrderInput,
  DecidePurchaseOrderInput,
  ShipPurchaseOrderInput,
  UpdateDeliveryInput,
  type PurchaseOrderStatus,
} from "@bahayplus/validation/supply/supply";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";

export type PurchaseOrderView = {
  id: string;
  number: number;
  supplierOrgId: string;
  buyerOrgId: string;
  supplierName: string;
  buyerName: string;
  status: PurchaseOrderStatus;
  totalCentavos: number;
  deliveryAddress: string;
  deliveryContact: string;
  requestedDeliveryOn: string | null;
  buyerNotes: string;
  supplierNotes: string;
  decisionReason: string | null;
  cancelledBy: "buyer" | "supplier" | null;
  submittedAt: string;
  acceptedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
};
export type PurchaseOrderLineView = {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPriceCentavos: number;
  lineTotalCentavos: number;
};
export type DeliveryView = {
  status: "out_for_delivery" | "delivered" | "failed";
  courier: string;
  trackingRef: string;
  scheduledFor: string | null;
  attempts: number;
  failureReason: string | null;
  receivedBy: string | null;
  deliveredAt: string | null;
};
export type PurchaseOrderDetail = PurchaseOrderView & { lines: PurchaseOrderLineView[]; delivery: DeliveryView | null };

const COLUMNS =
  "id, number, supplier_org_id, buyer_org_id, supplier_name, buyer_name, status, total_centavos, delivery_address, delivery_contact, requested_delivery_on, buyer_notes, supplier_notes, decision_reason, cancelled_by, submitted_at, accepted_at, shipped_at, delivered_at";

type Row = {
  id: string;
  number: number;
  supplier_org_id: string;
  buyer_org_id: string;
  supplier_name: string;
  buyer_name: string;
  status: string;
  total_centavos: number;
  delivery_address: string;
  delivery_contact: string;
  requested_delivery_on: string | null;
  buyer_notes: string;
  supplier_notes: string;
  decision_reason: string | null;
  cancelled_by: string | null;
  submitted_at: string;
  accepted_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
};
const toView = (r: Row): PurchaseOrderView => ({
  id: r.id,
  number: r.number,
  supplierOrgId: r.supplier_org_id,
  buyerOrgId: r.buyer_org_id,
  supplierName: r.supplier_name,
  buyerName: r.buyer_name,
  status: r.status as PurchaseOrderStatus,
  totalCentavos: r.total_centavos,
  deliveryAddress: r.delivery_address,
  deliveryContact: r.delivery_contact,
  requestedDeliveryOn: r.requested_delivery_on,
  buyerNotes: r.buyer_notes,
  supplierNotes: r.supplier_notes,
  decisionReason: r.decision_reason,
  cancelledBy: r.cancelled_by as PurchaseOrderView["cancelledBy"],
  submittedAt: r.submitted_at,
  acceptedAt: r.accepted_at,
  shippedAt: r.shipped_at,
  deliveredAt: r.delivered_at,
});

export async function listPurchaseOrders(
  ctx: ServiceContext,
  scope: { supplierOrgId: string } | { buyerOrgId: string },
  filter: { statuses?: PurchaseOrderStatus[]; limit?: number } = {},
): Promise<Result<PurchaseOrderView[]>> {
  let q = ctx.db.from("purchase_orders").select(COLUMNS);
  q = "supplierOrgId" in scope ? q.eq("supplier_org_id", scope.supplierOrgId) : q.eq("buyer_org_id", scope.buyerOrgId);
  if (filter.statuses?.length) q = q.in("status", filter.statuses);
  const { data, error } = await q.order("submitted_at", { ascending: false }).limit(filter.limit ?? 100);
  if (error) return err(mapDbError(error));
  return ok((data ?? []).map((r) => toView(r as Row)));
}

export async function getPurchaseOrder(
  ctx: ServiceContext,
  purchaseOrderId: string,
): Promise<Result<PurchaseOrderDetail>> {
  const { data, error } = await ctx.db
    .from("purchase_orders")
    .select(
      `${COLUMNS}, purchase_order_lines(id, product_id, sku, product_name, unit, quantity, unit_price_centavos, line_total_centavos), deliveries(status, courier, tracking_ref, scheduled_for, attempts, failure_reason, received_by, delivered_at)`,
    )
    .eq("id", purchaseOrderId)
    .maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Purchase order not found."));
  const d = Array.isArray(data.deliveries) ? data.deliveries[0] : data.deliveries;
  return ok({
    ...toView(data as unknown as Row),
    lines: (data.purchase_order_lines ?? []).map((l) => ({
      id: l.id,
      productId: l.product_id,
      sku: l.sku,
      productName: l.product_name,
      unit: l.unit,
      quantity: Number(l.quantity),
      unitPriceCentavos: l.unit_price_centavos,
      lineTotalCentavos: l.line_total_centavos ?? 0,
    })),
    delivery: d
      ? {
          status: d.status as DeliveryView["status"],
          courier: d.courier,
          trackingRef: d.tracking_ref,
          scheduledFor: d.scheduled_for,
          attempts: d.attempts,
          failureReason: d.failure_reason,
          receivedBy: d.received_by,
          deliveredAt: d.delivered_at,
        }
      : null,
  });
}

export type DeliveryListItem = DeliveryView & { purchaseOrderId: string; number: number; buyerName: string };

export async function listDeliveries(ctx: ServiceContext, supplierOrgId: string): Promise<Result<DeliveryListItem[]>> {
  const { data, error } = await ctx.db
    .from("deliveries")
    .select(
      "purchase_order_id, status, courier, tracking_ref, scheduled_for, attempts, failure_reason, received_by, delivered_at, purchase_orders!inner(number, buyer_name)",
    )
    .eq("supplier_org_id", supplierOrgId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((d) => ({
      purchaseOrderId: d.purchase_order_id,
      number: d.purchase_orders.number,
      buyerName: d.purchase_orders.buyer_name,
      status: d.status as DeliveryView["status"],
      courier: d.courier,
      trackingRef: d.tracking_ref,
      scheduledFor: d.scheduled_for,
      attempts: d.attempts,
      failureReason: d.failure_reason,
      receivedBy: d.received_by,
      deliveredAt: d.delivered_at,
    })),
  );
}

export async function createPurchaseOrder(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ purchaseOrderId: string }>> {
  const parsed = parseInput(CreatePurchaseOrderInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db.rpc("create_purchase_order", {
    p_payload: {
      buyer_org_id: v.buyerOrgId,
      supplier_org_id: v.supplierOrgId,
      lines: v.lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
      delivery_address: v.deliveryAddress,
      delivery_contact: v.deliveryContact,
      requested_delivery_on: v.requestedDeliveryOn,
      buyer_notes: v.buyerNotes,
      idempotency_key: v.idempotencyKey,
    },
  });
  if (error) return err(mapDbError(error));
  return ok({ purchaseOrderId: data });
}

export async function decidePurchaseOrder(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(DecidePurchaseOrderInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("decide_purchase_order", {
    p_po: parsed.value.purchaseOrderId,
    p_decision: parsed.value.decision,
    p_note: parsed.value.note,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function shipPurchaseOrder(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(ShipPurchaseOrderInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { error } = await ctx.db.rpc("ship_purchase_order", {
    p_po: v.purchaseOrderId,
    p_courier: v.courier,
    p_tracking: v.trackingRef,
    p_scheduled_for: v.scheduledFor as string,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function updateDelivery(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdateDeliveryInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("update_delivery", {
    p_po: parsed.value.purchaseOrderId,
    p_status: parsed.value.status,
    p_detail: parsed.value.detail,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function cancelPurchaseOrder(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(CancelPurchaseOrderInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("cancel_purchase_order", {
    p_po: parsed.value.purchaseOrderId,
    p_reason: parsed.value.reason,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export type SupplierMonth = {
  month: string;
  ordersReceived: number;
  ordersDelivered: number;
  ordersCancelled: number;
  revenueCentavos: number;
};
export type TopProduct = { productId: string; productName: string; quantity: number; revenueCentavos: number };

export async function supplierReport(
  ctx: ServiceContext,
  organizationId: string,
  months = 6,
): Promise<Result<{ months: SupplierMonth[]; topProducts: TopProduct[] }>> {
  const [report, top] = await Promise.all([
    ctx.db.rpc("supplier_report", { p_org: organizationId, p_months: months }),
    ctx.db.rpc("supplier_top_products", { p_org: organizationId, p_limit: 5 }),
  ]);
  if (report.error) return err(mapDbError(report.error));
  if (top.error) return err(mapDbError(top.error));
  return ok({
    months: (report.data ?? []).map((r) => ({
      month: r.month,
      ordersReceived: r.orders_received,
      ordersDelivered: r.orders_delivered,
      ordersCancelled: r.orders_cancelled,
      revenueCentavos: r.revenue_centavos,
    })),
    topProducts: (top.data ?? []).map((t) => ({
      productId: t.product_id,
      productName: t.product_name,
      quantity: Number(t.quantity),
      revenueCentavos: t.revenue_centavos,
    })),
  });
}
