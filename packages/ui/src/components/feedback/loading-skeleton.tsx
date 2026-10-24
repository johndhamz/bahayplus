import { cn } from "@bahayplus/ui/lib/utils";
import { Skeleton } from "@bahayplus/ui/components/ui/skeleton";

type LoadingSkeletonProps = {
  variant?: "cards" | "list" | "table" | "page" | "stats";
  count?: number;
  /** Announced to screen readers. */
  label?: string;
  className?: string;
};

export function LoadingSkeleton({ variant = "list", count = 3, label = "Loading…", className }: LoadingSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("w-full", className)} data-variant={variant}>
      <span className="sr-only">{label}</span>
      {variant === "page" && (
        <div className="flex flex-col gap-6" aria-hidden="true">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {items.slice(0, 4).map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      )}
      {variant === "stats" && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
          {items.map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}
      {variant === "cards" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {items.map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
              <Skeleton className="size-10 rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}
      {variant === "list" && (
        <ul className="flex flex-col gap-2" aria-hidden="true">
          {items.map((i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      )}
      {variant === "table" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface" aria-hidden="true">
          <Skeleton className="h-11 rounded-none" />
          {items.map((i) => (
            <div key={i} className="flex gap-4 border-t border-border px-4 py-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
