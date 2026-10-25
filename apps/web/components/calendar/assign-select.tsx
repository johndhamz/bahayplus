"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { assignCalendarItemAction } from "@/lib/actions/notifications";

export function AssignSelect({
  householdId,
  itemKey,
  title,
  current,
  members,
}: {
  householdId: string;
  itemKey: string;
  title: string;
  current: string | null;
  members: { userId: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={`Assign "${title}" to`}
      value={current ?? ""}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          const r = await assignCalendarItemAction({ householdId, itemKey, userId: e.target.value });
          if (!r.ok) return void toast.error(r.error.message);
          toast.success("Assignment saved.");
          router.refresh();
        })
      }
      className="h-10 max-w-44 rounded-lg border border-input bg-surface px-2 text-sm"
    >
      <option value="">Unassigned</option>
      {members.map((m) => (
        <option key={m.userId} value={m.userId}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
