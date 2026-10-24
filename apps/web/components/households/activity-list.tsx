import { Activity } from "lucide-react";
import type { ActivityItem } from "@bahayplus/modules/households";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { formatManilaDateTime } from "@bahayplus/types/dates";

export function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={Activity}
        title="No activity yet"
        description="Changes to your household will show up here."
      />
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="border-l-2 border-gold pl-3">
          <p className="text-sm">{item.text}</p>
          <p className="text-xs text-muted-foreground">
            <time dateTime={item.occurredAt}>{formatManilaDateTime(item.occurredAt)}</time>
          </p>
        </li>
      ))}
    </ol>
  );
}
