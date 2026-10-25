import { BellRing } from "lucide-react";
import Link from "next/link";
import { describeDays, type DueItem } from "@bahayplus/modules/scheduling";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { StatusBadge, type StatusTone } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate } from "@bahayplus/types/dates";

const TONE: Record<DueItem["status"], StatusTone> = {
  overdue: "danger",
  due_today: "warning",
  due_soon: "warning",
  upcoming: "info",
};
const STATUS_LABEL: Record<DueItem["status"], string> = {
  overdue: "Overdue",
  due_today: "Today",
  due_soon: "Soon",
  upcoming: "Upcoming",
};
const PATH = { asset: "assets", pet: "pets", vehicle: "vehicles" } as const;

export function DueList({ items, basePath, emptyText }: { items: DueItem[]; basePath: string; emptyText?: string }) {
  if (items.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={BellRing}
        title="Nothing due"
        description={emptyText ?? "Warranty, maintenance, vaccination and registration dates will appear here."}
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <li key={`${item.subjectId}-${item.dueKind}-${item.dueOn}`} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <Link
              href={`${basePath}/${PATH[item.subjectType]}/${item.subjectId}`}
              className="block truncate text-sm font-medium hover:underline"
            >
              {item.label}: {item.subjectName}
            </Link>
            <p className="text-xs text-muted-foreground">
              {formatManilaDate(item.dueOn)} · {describeDays(item.days)}
            </p>
          </div>
          <StatusBadge status={item.status} tone={TONE[item.status]} label={STATUS_LABEL[item.status]} />
        </li>
      ))}
    </ul>
  );
}
