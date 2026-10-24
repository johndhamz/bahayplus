"use client";

import { Archive, ArchiveRestore, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { Button } from "@bahayplus/ui/components/ui/button";
import type { PropertyView } from "@bahayplus/modules/properties";
import { archivePropertyAction, restorePropertyAction, setDefaultPropertyAction } from "@/lib/actions/properties";

export function PropertyActions({ property }: { property: PropertyView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = async (action: () => Promise<{ ok: boolean; message?: string; error?: { message: string } }>) => {
    const result = await action();
    if (result.ok) {
      toast.success(result.message ?? "Done.");
      router.refresh();
      return true;
    }
    toast.error(result.error?.message ?? "That didn't work.");
    return false;
  };

  if (property.archivedAt) {
    return (
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(() => void run(() => restorePropertyAction({ propertyId: property.id })))}
      >
        <ArchiveRestore aria-hidden="true" />
        Restore property
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!property.isDefault && property.isActive && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(
              () =>
                void run(() =>
                  setDefaultPropertyAction({ householdId: property.householdId, propertyId: property.id }),
                ),
            )
          }
        >
          <Star aria-hidden="true" />
          Make default
        </Button>
      )}
      <ConfirmationDialog
        title={`Archive “${property.name}”?`}
        description={
          <>
            Archived properties leave your active lists but keep their history and anything linked to them. You can
            restore it at any time.{property.isDefault ? " It will stop being your default property." : ""}
          </>
        }
        confirmLabel="Archive"
        tone="destructive"
        onConfirm={() => run(() => archivePropertyAction({ propertyId: property.id }))}
        trigger={
          <Button variant="outline" className="text-destructive">
            <Archive aria-hidden="true" />
            Archive
          </Button>
        }
      />
    </div>
  );
}
