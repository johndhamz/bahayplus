"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@bahayplus/types/action-result";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { Button } from "@bahayplus/ui/components/ui/button";

type Props = {
  archived: boolean;
  label: string;
  archive: () => Promise<ActionResult<true>>;
  restore: () => Promise<ActionResult<true>>;
  description: string;
};

export function ArchiveToggle({ archived, label, archive, restore, description }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const handle = async (fn: () => Promise<ActionResult<true>>) => {
    const r = await fn();
    if (!r.ok) {
      toast.error(r.error.message);
      return false;
    }
    toast.success(r.message ?? "Done.");
    router.refresh();
    return true;
  };
  if (archived) {
    return (
      <Button variant="outline" disabled={pending} onClick={() => startTransition(() => void handle(restore))}>
        <ArchiveRestore aria-hidden="true" /> Restore
      </Button>
    );
  }
  return (
    <ConfirmationDialog
      title={`Archive ${label}?`}
      description={description}
      confirmLabel="Archive"
      tone="destructive"
      onConfirm={() => handle(archive)}
      trigger={
        <Button variant="outline" className="text-destructive">
          <Archive aria-hidden="true" /> Archive
        </Button>
      }
    />
  );
}
