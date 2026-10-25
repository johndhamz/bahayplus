"use server";

import { revalidatePath } from "next/cache";
import * as files from "@bahayplus/modules/files";
import * as marketplace from "@bahayplus/modules/marketplace";
import * as providers from "@bahayplus/modules/providers";
import type { ServiceContext } from "@bahayplus/modules/authorization";
import { fromResult, type ActionResult } from "@bahayplus/types/action-result";
import type { Result } from "@bahayplus/types/result";
import { getServiceContext } from "@/lib/auth/context";

async function run<T>(fn: (ctx: ServiceContext) => Promise<Result<T>>, message: string): Promise<ActionResult<T>> {
  const ctx = await getServiceContext();
  if (!ctx)
    return { ok: false, error: { code: "UNAUTHENTICATED", message: "Your session has ended. Please sign in again." } };
  const result = await fn(ctx);
  if (result.ok) {
    revalidatePath("/provider/o/[orgId]", "layout");
    revalidatePath("/app/h/[householdId]", "layout");
    revalidatePath("/admin", "layout");
  }
  return fromResult(result, message);
}

export const updateProviderProfileAction = async (i: unknown) =>
  run((c) => providers.updateProviderProfile(c, i), "Profile saved.");
export const setAvailabilityAction = async (i: unknown) =>
  run((c) => providers.setAvailability(c, i), "Availability updated.");
export const createProviderServiceAction = async (i: unknown) =>
  run((c) => providers.createProviderService(c, i), "Service added.");
export const updateProviderServiceAction = async (i: unknown) =>
  run((c) => providers.updateProviderService(c, i), "Service saved.");
export const deleteProviderServiceAction = async (i: unknown) =>
  run((c) => providers.deleteProviderService(c, i), "Service removed.");
export const addServiceAreaAction = async (i: unknown) => run((c) => providers.addServiceArea(c, i), "Area added.");
export const removeServiceAreaAction = async (i: unknown) =>
  run((c) => providers.removeServiceArea(c, i), "Area removed.");
export const createPortfolioItemAction = async (i: unknown) =>
  run((c) => providers.createPortfolioItem(c, i), "Project added.");
export const deletePortfolioItemAction = async (i: unknown) =>
  run((c) => providers.deletePortfolioItem(c, i), "Project removed.");
export const submitVerificationAction = async (i: unknown) =>
  run((c) => providers.submitVerification(c, i), "Submitted for verification.");
export const startVerificationReviewAction = async (i: unknown) =>
  run((c) => providers.startVerificationReview(c, i), "Review started.");
export const decideVerificationAction = async (i: unknown) =>
  run((c) => providers.decideVerification(c, i), "Decision saved.");
export const revokeVerificationAction = async (i: unknown) =>
  run((c) => providers.revokeVerification(c, i), "Verification revoked.");
export const replyToReviewAction = async (i: unknown) => run((c) => providers.replyToReview(c, i), "Reply posted.");
export const submitReviewAction = async (i: unknown) =>
  run((c) => marketplace.submitReview(c, i), "Thanks for your review!");
export const editReviewAction = async (i: unknown) => run((c) => marketplace.editReview(c, i), "Review updated.");
export const prepareOrgUploadAction = async (i: unknown) =>
  run((c) => files.prepareOrgUpload(c, i), "Ready to upload.");
export const registerOrgFileAction = async (i: unknown) => run((c) => files.registerOrgFile(c, i), "File uploaded.");
