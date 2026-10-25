export type BookingStatus = "requested" | "confirmed" | "in_progress" | "completed" | "cancelled" | "declined";
export type BookingAction = "confirm" | "decline" | "start" | "complete" | "cancel";
export type Side = "customer" | "provider";

/** Mirrors public.transition_booking so the UI only offers valid actions. */
export function allowedBookingActions(status: BookingStatus, side: Side): BookingAction[] {
  const actions: BookingAction[] = [];
  if (side === "provider") {
    if (status === "requested") actions.push("confirm", "decline");
    if (status === "confirmed") actions.push("start");
    if (status === "confirmed" || status === "in_progress") actions.push("complete");
  }
  if (status === "requested" || status === "confirmed") actions.push("cancel");
  return actions;
}

export const canReschedule = (status: BookingStatus) => status === "requested" || status === "confirmed";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Waiting for provider",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
};

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "superseded" | "withdrawn";

/** A sent quotation can be accepted only while valid (Manila calendar date). */
export function isQuotationOpen(q: { status: QuotationStatus; validUntil: string | null }, today: string): boolean {
  return q.status === "sent" && !!q.validUntil && q.validUntil >= today;
}

export type WorkOrderStatus = "scheduled" | "assigned" | "en_route" | "in_progress" | "completed" | "cancelled";
export const WORK_ORDER_NEXT: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  scheduled: ["cancelled"],
  assigned: ["en_route", "in_progress", "cancelled"],
  en_route: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};
