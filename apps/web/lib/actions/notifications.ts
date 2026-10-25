"use server";

import { revalidatePath } from "next/cache";
import * as notifications from "@bahayplus/modules/notifications";
import * as scheduling from "@bahayplus/modules/scheduling";
import type { ServiceContext } from "@bahayplus/modules/authorization";
import { fromResult, type ActionResult } from "@bahayplus/types/action-result";
import type { Result } from "@bahayplus/types/result";
import { getServiceContext } from "@/lib/auth/context";

async function run<T>(fn: (ctx: ServiceContext) => Promise<Result<T>>, message: string): Promise<ActionResult<T>> {
  const ctx = await getServiceContext();
  if (!ctx)
    return { ok: false, error: { code: "UNAUTHENTICATED", message: "Your session has ended. Please sign in again." } };
  const result = await fn(ctx);
  if (result.ok) revalidatePath("/", "layout");
  return fromResult(result, message);
}

export const markNotificationsReadAction = async (i: unknown) =>
  run((c) => notifications.markRead(c, i), "Marked as read.");
export const updateNotificationPreferencesAction = async (i: unknown) =>
  run((c) => notifications.updatePreferences(c, i), "Notification settings saved.");
export const assignCalendarItemAction = async (i: unknown) =>
  run((c) => scheduling.assignCalendarItem(c, i), "Assignment saved.");
