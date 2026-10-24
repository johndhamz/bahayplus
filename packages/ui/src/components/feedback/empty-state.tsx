import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@bahayplus/ui/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  /** Compact variant for use inside cards. */
  size?: "default" | "compact";
  /** Element for the title; use "h1" when the empty state is the whole page. */
  titleAs?: "p" | "h1" | "h2" | "h3";
};

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
  size = "default",
  titleAs: Title = "p",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/60 text-center",
        size === "compact" ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-full bg-sage text-brand",
          size === "compact" ? "size-10" : "size-14",
        )}
      >
        <Icon aria-hidden="true" className={size === "compact" ? "size-5" : "size-7"} />
      </span>
      <div className="max-w-sm">
        <Title className={cn("font-heading font-semibold text-foreground", size === "compact" ? "text-sm" : "text-lg")}>
          {title}
        </Title>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
