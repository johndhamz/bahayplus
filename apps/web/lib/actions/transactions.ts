"use server";

import { revalidatePath } from "next/cache";
import * as bookings from "@bahayplus/modules/bookings";
import * as files from "@bahayplus/modules/files";
import * as projects from "@bahayplus/modules/projects";
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
    revalidatePath("/app/h/[householdId]", "layout");
    revalidatePath("/provider/o/[orgId]", "layout");
    revalidatePath("/worker", "layout");
  }
  return fromResult(result, message);
}

export const requestBookingAction = async (i: unknown) => run((c) => bookings.requestBooking(c, i), "Booking sent.");
export const transitionBookingAction = async (i: unknown) =>
  run((c) => bookings.transitionBooking(c, i), "Booking updated.");
export const rescheduleBookingAction = async (i: unknown) =>
  run((c) => bookings.rescheduleBooking(c, i), "Booking rescheduled.");
export const confirmCompletionAction = async (i: unknown) =>
  run((c) => bookings.confirmBookingCompletion(c, i), "Thanks for confirming.");
export const createServiceRequestAction = async (i: unknown) =>
  run((c) => bookings.createServiceRequest(c, i), "Quote request sent.");
export const createQuotationDraftAction = async (i: unknown) =>
  run((c) => bookings.createQuotationDraft(c, i), "Draft created.");
export const saveQuotationDraftAction = async (i: unknown) =>
  run((c) => bookings.saveQuotationDraft(c, i), "Draft saved.");
export const sendQuotationAction = async (i: unknown) => run((c) => bookings.sendQuotation(c, i), "Quotation sent.");
export const withdrawQuotationAction = async (i: unknown) =>
  run((c) => bookings.withdrawQuotation(c, i), "Quotation withdrawn.");
export const decideQuotationAction = async (i: unknown) =>
  run((c) => bookings.decideQuotation(c, i), "Decision saved.");
export const createWorkOrderAction = async (i: unknown) =>
  run((c) => bookings.createWorkOrder(c, i), "Work order created.");
export const assignWorkOrderAction = async (i: unknown) =>
  run((c) => bookings.assignWorkOrder(c, i), "Worker assigned.");
export const updateWorkOrderStatusAction = async (i: unknown) =>
  run((c) => bookings.updateWorkOrderStatus(c, i), "Status updated.");
export const toggleChecklistItemAction = async (i: unknown) =>
  run((c) => bookings.toggleChecklistItem(c, i), "Checklist updated.");
export const createProjectRequestAction = async (i: unknown) =>
  run((c) => projects.createProjectRequest(c, i), "Project request sent.");
export const updateProjectAction = async (i: unknown) => run((c) => projects.updateProject(c, i), "Project updated.");
export const startProjectQuotationAction = async (i: unknown) =>
  run((c) => projects.startProjectQuotation(c, i), "Quotation draft created.");
export const acceptProjectQuotationAction = async (i: unknown) =>
  run((c) => projects.acceptProjectQuotation(c, i), "Contract accepted.");
export const addMilestoneAction = async (i: unknown) => run((c) => projects.addMilestone(c, i), "Milestone added.");
export const setMilestoneStatusAction = async (i: unknown) =>
  run((c) => projects.setMilestoneStatus(c, i), "Milestone updated.");
export const postProjectUpdateAction = async (i: unknown) =>
  run((c) => projects.postProjectUpdate(c, i), "Update posted.");
export const proposeChangeOrderAction = async (i: unknown) =>
  run((c) => projects.proposeChangeOrder(c, i), "Change order sent to the customer.");
export const decideChangeOrderAction = async (i: unknown) =>
  run((c) => projects.decideChangeOrder(c, i), "Decision saved.");
export const prepareSharedUploadAction = async (i: unknown) =>
  run((c) => files.prepareUpload(c, i), "Ready to upload.");
