import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@bahayplus/ui/lib/utils";

type SectionCardProps = {
  title: string;
  /** Link shown in the card header, e.g. "See all". */
  action?: { href: string; label: string };
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
};

/** Titled panel used for dashboard sections and activity panels. */
export function SectionCard({ title, action, headerExtra, children, className, id }: SectionCardProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      aria-labelledby={headingId}
      aria-label={headingId ? undefined : title}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 id={headingId} className="font-heading text-base font-semibold text-foreground sm:text-lg">
            {title}
          </h2>
          {headerExtra}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex min-h-10 items-center gap-0.5 rounded-md px-1 text-sm font-medium text-brand hover:underline dark:text-primary"
          >
            {action.label}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
