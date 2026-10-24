"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@bahayplus/ui/components/ui/alert-dialog";
import { Button } from "@bahayplus/ui/components/ui/button";

type ConfirmationDialogProps = {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "destructive" styles the confirm button as a danger action. */
  tone?: "default" | "destructive";
  /**
   * Called on confirm. The dialog stays open with a pending state until it resolves.
   * Return `false` (or throw) to keep the dialog open, e.g. when the server rejects the action.
   */
  onConfirm: () => Promise<boolean | void> | boolean | void;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ConfirmationDialog({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: ConfirmationDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (value: boolean) => {
    if (pending) return;
    if (!value) setError(null);
    onOpenChange?.(value);
    if (controlledOpen === undefined) setUncontrolledOpen(value);
  };

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onConfirm();
        if (result !== false) {
          onOpenChange?.(false);
          if (controlledOpen === undefined) setUncontrolledOpen(false);
        }
      } catch {
        setError("That didn't work. Please try again.");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button
            variant={tone === "destructive" ? "destructive" : "default"}
            className={tone === "destructive" ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={handleConfirm}
            disabled={pending}
            aria-busy={pending}
          >
            {pending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
