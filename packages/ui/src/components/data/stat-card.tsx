import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@bahayplus/ui/lib/utils";

type StatCardProps = {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  /** Optional context line, e.g. "3 due this week". */
  hint?: ReactNode;
  /** Change versus a comparison period. Direction is explicit so "up" isn't assumed to be good. */
  trend?: { direction: "up" | "down"; label: string; sentiment?: "positive" | "negative" | "neutral" };
  href?: string;
  tone?: "default" | "brand" | "gold" | "terracotta";
  className?: string;
  badge?: ReactNode;
};

const TONES = {
  default: "bg-surface text-foreground",
  brand: "bg-brand text-brand-foreground",
  gold: "bg-accent text-accent-foreground",
  terracotta: "bg-surface text-foreground border-l-4 border-l-terracotta",
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  href,
  tone = "default",
  className,
  badge,
}: StatCardProps) {
  const sentiment = trend?.sentiment ?? "neutral";
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn("text-sm font-medium", tone === "brand" ? "text-brand-foreground/80" : "text-muted-foreground")}
        >
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl",
              tone === "brand" ? "bg-white/10 text-gold" : "bg-sage text-brand",
            )}
          >
            <Icon aria-hidden="true" className="size-5" />
          </span>
        )}
      </div>
      <p className="font-heading text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      {(hint || trend || badge) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                sentiment === "positive" && "bg-success-soft text-success",
                sentiment === "negative" && "bg-danger-soft text-destructive",
                sentiment === "neutral" && "bg-muted text-muted-foreground",
              )}
            >
              {trend.direction === "up" ? (
                <TrendingUp aria-hidden="true" className="size-3.5" />
              ) : (
                <TrendingDown aria-hidden="true" className="size-3.5" />
              )}
              <span className="sr-only">{trend.direction === "up" ? "Up" : "Down"}</span>
              {trend.label}
            </span>
          )}
          {hint && (
            <span className={tone === "brand" ? "text-brand-foreground/80" : "text-muted-foreground"}>{hint}</span>
          )}
          {badge}
        </div>
      )}
    </>
  );

  const classes = cn(
    "flex flex-col gap-2 rounded-2xl border border-border p-4 shadow-card sm:p-5",
    TONES[tone],
    href && "transition-shadow hover:shadow-md focus-visible:outline-ring",
    className,
  );

  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
