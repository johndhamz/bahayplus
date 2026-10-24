"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@bahayplus/ui/lib/utils";
import { Button } from "@bahayplus/ui/components/ui/button";

type ErrorStateProps = {
  title?: string;
  description?: ReactNode;
  /** Support reference shown to the user (never a stack trace). */
  reference?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
};

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now. Please try again.",
  reference,
  onRetry,
  retryLabel = "Try again",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/25 bg-danger-soft px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-surface text-destructive">
        <TriangleAlert aria-hidden="true" className="size-7" />
      </span>
      <div className="max-w-sm">
        <p className="font-heading text-lg font-semibold text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {reference && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {reference}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            {retryLabel}
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
