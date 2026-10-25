import { Clock, MapPin } from "lucide-react";
import Link from "next/link";
import type { WorkOrderView } from "@bahayplus/modules/bookings";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { WORK_ORDER_STATUS_LABELS } from "@/components/transactions/work-order-forms";

const time = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );

export function JobList({ jobs, orgName }: { jobs: WorkOrderView[]; orgName: Map<string, string> }) {
  return (
    <ul className="flex flex-col gap-3">
      {jobs.map((j) => {
        const done = j.checklist.filter((c) => c.isDone).length;
        return (
          <li key={j.id}>
            <Link
              href={`/worker/jobs/${j.id}`}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-brand"
            >
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 font-heading font-semibold">{j.title}</p>
                <StatusBadge status={j.status} label={WORK_ORDER_STATUS_LABELS[j.status]} />
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock aria-hidden="true" className="size-4" /> {time(j.scheduledStart)} – {time(j.scheduledEnd)}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin aria-hidden="true" className="size-3.5" /> {orgName.get(j.organizationId) ?? "Your provider"}
                {j.checklist.length > 0 && ` · checklist ${done}/${j.checklist.length}`}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
