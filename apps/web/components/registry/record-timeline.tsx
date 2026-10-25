"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@bahayplus/types/action-result";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { Button } from "@bahayplus/ui/components/ui/button";

export type TimelineItem = { id: string; date: string; title: string; detail?: ReactNode; meta?: ReactNode };

export function RecordTimeline({
  items,
  empty,
  deleteAction,
}: {
  items: TimelineItem[];
  empty: string;
  /** A Server Action (passed by reference from a Server Component) that deletes one record. */
  deleteAction?: (input: { recordId: string }) => Promise<ActionResult<true>>;
}) {
  const router = useRouter();
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 border-l-2 border-gold pl-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.date}</p>
            {item.detail && <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>}
            {item.meta && <div className="mt-1 text-xs">{item.meta}</div>}
          </div>
          {deleteAction && (
            <ConfirmationDialog
              title="Delete this record?"
              description="This can't be undone."
              confirmLabel="Delete"
              tone="destructive"
              onConfirm={async () => {
                const r = await deleteAction({ recordId: item.id });
                if (!r.ok) {
                  toast.error(r.error.message);
                  return false;
                }
                toast.success("Record deleted.");
                router.refresh();
              }}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${item.title}`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              }
            />
          )}
        </li>
      ))}
    </ol>
  );
}
