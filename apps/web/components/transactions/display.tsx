import Link from "next/link";
import {
  BOOKING_STATUS_LABELS,
  type BookingEventView,
  type BookingView,
  type QuotationView,
} from "@bahayplus/modules/bookings";
import type { ChangeOrderView, ProjectUpdateView, ProjectView } from "@bahayplus/modules/projects";
import { StatusBadge, type StatusTone } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate, formatManilaDateTime } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";

const BOOKING_TONE: Record<BookingView["status"], StatusTone> = {
  requested: "warning",
  confirmed: "success",
  in_progress: "info",
  completed: "success",
  cancelled: "neutral",
  declined: "danger",
};

export function BookingStatusBadge({ status }: { status: BookingView["status"] }) {
  return <StatusBadge status={status} tone={BOOKING_TONE[status]} label={BOOKING_STATUS_LABELS[status]} />;
}

export function BookingList({
  bookings,
  hrefBase,
  showProvider,
}: {
  bookings: BookingView[];
  hrefBase: string;
  showProvider: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {bookings.map((b) => (
        <li key={b.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <Link href={`${hrefBase}/${b.id}`} className="font-medium hover:underline">
              {b.title || "Service booking"}
            </Link>
            <p className="text-xs text-muted-foreground">
              {showProvider ? `${b.providerName} · ` : ""}
              {b.scheduledStart ? formatManilaDateTime(b.scheduledStart) : "Schedule to be agreed"}
              {b.agreedAmountCentavos !== null ? ` · ${formatPeso(b.agreedAmountCentavos)}` : ""}
            </p>
          </div>
          <BookingStatusBadge status={b.status} />
        </li>
      ))}
    </ul>
  );
}

const EVENT_LABELS: Record<string, string> = {
  created: "Booking requested",
  created_from_quotation: "Booked from accepted quotation",
  confirm: "Confirmed by provider",
  decline: "Declined by provider",
  start: "Job started",
  complete: "Marked completed",
  cancel: "Cancelled",
  rescheduled: "Rescheduled",
  completion_confirmed: "Customer confirmed the job is done",
  completion_disputed: "Customer reported a problem",
};

export function BookingTimeline({ events }: { events: BookingEventView[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="flex flex-col gap-3 border-l-2 border-sage pl-4">
      {events.map((e) => (
        <li key={e.id} className="text-sm">
          <p className="font-medium">{EVENT_LABELS[e.kind] ?? e.kind.replaceAll("_", " ")}</p>
          <p className="text-xs text-muted-foreground">
            {formatManilaDateTime(e.createdAt)} ·{" "}
            {e.actorSide === "customer" ? "Customer" : e.actorSide === "provider" ? "Provider" : "System"}
            {typeof e.payload.reason === "string" && e.payload.reason ? ` · ${e.payload.reason}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

const QUOTATION_TONE: Record<QuotationView["status"], StatusTone> = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  rejected: "danger",
  superseded: "neutral",
  withdrawn: "neutral",
};

export function QuotationSummary({ quotation, expired }: { quotation: QuotationView; expired?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-heading font-semibold">Version {quotation.version}</h3>
        <StatusBadge
          status={quotation.status}
          tone={expired ? "neutral" : QUOTATION_TONE[quotation.status]}
          label={expired ? "Expired" : undefined}
        />
        {quotation.validUntil && quotation.status === "sent" && (
          <span className="text-xs text-muted-foreground">Valid until {formatManilaDate(quotation.validUntil)}</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <caption className="sr-only">Quotation version {quotation.version} items</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase">
              <th scope="col" className="pb-1 font-semibold">
                Item
              </th>
              <th scope="col" className="pb-1 text-right font-semibold">
                Qty
              </th>
              <th scope="col" className="pb-1 text-right font-semibold">
                Unit price
              </th>
              <th scope="col" className="pb-1 text-right font-semibold">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {quotation.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-1.5">{l.description}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {l.quantity} {l.unitLabel}
                </td>
                <td className="py-1.5 text-right tabular-nums">{formatPeso(l.unitPriceCentavos)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatPeso(l.lineTotalCentavos)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3} className="pt-2 text-right">
                Total
              </th>
              <td className="pt-2 text-right font-semibold tabular-nums">{formatPeso(quotation.totalCentavos)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {quotation.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{quotation.notes}</p>}
    </div>
  );
}

const PROJECT_LABELS: Record<ProjectView["status"], string> = {
  requested: "Requested",
  site_visit_scheduled: "Site visit scheduled",
  quoted: "Quoted",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};
const PROJECT_TONE: Record<ProjectView["status"], StatusTone> = {
  requested: "warning",
  site_visit_scheduled: "info",
  quoted: "info",
  active: "success",
  on_hold: "warning",
  completed: "success",
  cancelled: "neutral",
};

export function ProjectStatusBadge({
  status,
  contracted = false,
}: {
  status: ProjectView["status"];
  contracted?: boolean;
}) {
  const label = status === "quoted" && contracted ? "Contract accepted" : PROJECT_LABELS[status];
  return (
    <StatusBadge
      status={status}
      tone={status === "quoted" && contracted ? "success" : PROJECT_TONE[status]}
      label={label}
    />
  );
}

export function ProjectList({
  projects,
  hrefBase,
  showProvider,
}: {
  projects: ProjectView[];
  hrefBase: string;
  showProvider: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {projects.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <Link href={`${hrefBase}/${p.id}`} className="font-medium hover:underline">
              {p.title}
            </Link>
            <p className="text-xs text-muted-foreground">
              {showProvider ? `${p.providerName} · ` : ""}
              {p.currentAmountCentavos !== null ? formatPeso(p.currentAmountCentavos) : "Awaiting quotation"}
              {p.targetEndDate ? ` · target ${formatManilaDate(p.targetEndDate)}` : ""}
            </p>
          </div>
          <ProjectStatusBadge status={p.status} contracted={!!p.contractQuotationId} />
        </li>
      ))}
    </ul>
  );
}

export function ProjectUpdates({ updates }: { updates: ProjectUpdateView[] }) {
  if (!updates.length) return <p className="text-sm text-muted-foreground">No updates yet.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {updates.map((u) => (
        <li key={u.id} className={`rounded-xl p-3 text-sm ${u.authorSide === "provider" ? "bg-sage/50" : "bg-muted"}`}>
          <p className="whitespace-pre-line">{u.body}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {u.authorSide === "provider" ? "Provider" : "Customer"} · {formatManilaDateTime(u.createdAt)}
            {u.percentComplete !== null ? ` · ${u.percentComplete}% complete` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function changeOrderAmount(c: ChangeOrderView) {
  return `${c.amountDeltaCentavos >= 0 ? "+" : "−"}${formatPeso(Math.abs(c.amountDeltaCentavos))}`;
}

/** Minimum value for datetime-local inputs: now in Manila, to the minute. */
export function manilaNowLocal(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Converts a UTC timestamp to a Manila datetime-local value (for edit forms). */
export function toManilaLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 8 * 3_600_000);
  return d.toISOString().slice(0, 16);
}
