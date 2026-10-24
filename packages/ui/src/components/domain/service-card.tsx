import type { LucideIcon } from "lucide-react";
import { ChevronRight, Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@bahayplus/ui/lib/utils";

type ServiceCardProps = {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  division?: string;
  urgentEligible?: boolean;
  /** "tile" for the compact quick-category grid, "row" for lists. */
  variant?: "tile" | "row";
  className?: string;
};

export function ServiceCard({
  name,
  href,
  icon: Icon,
  description,
  division,
  urgentEligible,
  variant = "row",
  className,
}: ServiceCardProps) {
  if (variant === "tile") {
    return (
      <Link
        href={href}
        className={cn(
          "group flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-3 text-center shadow-card transition-colors hover:border-brand/40 hover:bg-sage/40",
          className,
        )}
      >
        <span className="grid size-11 place-items-center rounded-xl bg-sage text-brand transition-colors group-hover:bg-brand group-hover:text-gold">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <span className="text-xs leading-tight font-semibold text-foreground sm:text-sm">{name}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-brand/40",
        className,
      )}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sage text-brand">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-heading font-semibold text-foreground">{name}</span>
          {urgentEligible && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-destructive">
              <Zap aria-hidden="true" className="size-3" />
              Urgent help available
            </span>
          )}
        </span>
        {division && <span className="block text-xs text-terracotta-strong">{division}</span>}
        {description && <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>}
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
