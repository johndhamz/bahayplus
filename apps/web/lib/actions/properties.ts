"use server";

import { revalidatePath } from "next/cache";
import {
  archiveProperty,
  createProperty,
  restoreProperty,
  setDefaultProperty,
  updateProperty,
} from "@bahayplus/modules/properties";
import { fromResult, type ActionResult } from "@bahayplus/types/action-result";
import { getServiceContext } from "@/lib/auth/context";

const UNAUTHENTICATED: ActionResult<never> = {
  ok: false,
  error: { code: "UNAUTHENTICATED", message: "Your session has ended. Please sign in again." },
};

function revalidateHousehold() {
  revalidatePath("/app/h/[householdId]", "layout");
}

export async function createPropertyAction(input: unknown): Promise<ActionResult<{ propertyId: string }>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await createProperty(ctx, input);
  if (result.ok) revalidateHousehold();
  return fromResult(result, "Property added.");
}

export async function updatePropertyAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await updateProperty(ctx, input);
  if (result.ok) revalidateHousehold();
  return fromResult(result, "Property saved.");
}

export async function archivePropertyAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await archiveProperty(ctx, input);
  if (result.ok) revalidateHousehold();
  return fromResult(result, "Property archived.");
}

export async function restorePropertyAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await restoreProperty(ctx, input);
  if (result.ok) revalidateHousehold();
  return fromResult(result, "Property restored.");
}

export async function setDefaultPropertyAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await setDefaultProperty(ctx, input);
  if (result.ok) revalidateHousehold();
  return fromResult(result, "Default property updated.");
}
