import type { ReactNode } from "react";
import { cn } from "@bahayplus/ui/lib/utils";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  /** Small label above the title, e.g. the active household. */
  eyebrow?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, breadcrumbs, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-sm font-medium text-terracotta-strong">{eyebrow}</p>}
          <h1 className="text-2xl font-bold text-brand sm:text-3xl dark:text-foreground">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
