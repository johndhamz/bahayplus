"use server";

import { revalidatePath } from "next/cache";
import * as admin from "@bahayplus/modules/admin";
import * as inventory from "@bahayplus/modules/inventory";
import * as suppliers from "@bahayplus/modules/suppliers";
import { setCapacity } from "@bahayplus/modules/providers";
import type { ServiceContext } from "@bahayplus/modules/authorization";
import { fromResult, type ActionResult } from "@bahayplus/types/action-result";
import type { Result } from "@bahayplus/types/result";
import { getServiceContext } from "@/lib/auth/context";

async function run<T>(
  fn: (ctx: ServiceContext) => Promise<Result<T>>,
  message: string,
  paths: string[],
): Promise<ActionResult<T>> {
  const ctx = await getServiceContext();
  if (!ctx)
    return { ok: false, error: { code: "UNAUTHENTICATED", message: "Your session has ended. Please sign in again." } };
  const result = await fn(ctx);
  if (result.ok) for (const p of paths) revalidatePath(p, "layout");
  return fromResult(result, message);
}

const SUPPLIER = ["/supplier"];
const ORDERS = ["/supplier", "/provider"];
const ADMIN = ["/admin"];

// Supplier catalog & inventory
export const updateSupplierProfileAction = async (i: unknown) =>
  run((c) => suppliers.updateSupplierProfile(c, i), "Profile saved.", SUPPLIER);
export const createProductAction = async (i: unknown) =>
  run((c) => suppliers.createProduct(c, i), "Product added.", SUPPLIER);
export const updateProductAction = async (i: unknown) =>
  run((c) => suppliers.updateProduct(c, i), "Product saved.", SUPPLIER);
export const recordStockAction = async (i: unknown) =>
  run((c) => inventory.recordStockMovement(c, i), "Stock updated.", SUPPLIER);

// Purchase orders (both sides)
export const createPurchaseOrderAction = async (i: unknown) =>
  run((c) => suppliers.createPurchaseOrder(c, i), "Purchase order sent.", ORDERS);
export const decidePurchaseOrderAction = async (i: unknown) =>
  run((c) => suppliers.decidePurchaseOrder(c, i), "Order updated.", ORDERS);
export const shipPurchaseOrderAction = async (i: unknown) =>
  run((c) => suppliers.shipPurchaseOrder(c, i), "Marked as shipped.", ORDERS);
export const updateDeliveryAction = async (i: unknown) =>
  run((c) => suppliers.updateDelivery(c, i), "Delivery updated.", ORDERS);
export const cancelPurchaseOrderAction = async (i: unknown) =>
  run((c) => suppliers.cancelPurchaseOrder(c, i), "Order cancelled.", ORDERS);

// Provider availability capacity
export const setCapacityAction = async (i: unknown) => run((c) => setCapacity(c, i), "Capacity saved.", ["/provider"]);

// Platform admin (each command is permission-checked and audited in the database)
export const setOrganizationStatusAction = async (i: unknown) =>
  run((c) => admin.setOrganizationStatus(c, i), "Organization updated.", ADMIN);
export const setUserSuspensionAction = async (i: unknown) =>
  run((c) => admin.setUserSuspension(c, i), "User updated.", ADMIN);
export const saveCategoryAction = async (i: unknown) => run((c) => admin.saveCategory(c, i), "Category saved.", ADMIN);
export const updateDisputeAction = async (i: unknown) =>
  run((c) => admin.updateDispute(c, i), "Dispute updated.", ADMIN);
export const updatePlatformSettingAction = async (i: unknown) =>
  run((c) => admin.updatePlatformSetting(c, i), "Setting saved.", ["/"]);
