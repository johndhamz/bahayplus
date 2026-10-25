import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";

/** Standalone frame for account pages (not tied to a household or business context). */
export function AccountFrame({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="flex h-16 items-center gap-4 border-b border-border bg-surface px-4 sm:px-6">
        <BrandMark />
      </header>
      <main id="main-content" className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <Link
          href="/app"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to Bahay+
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-brand">{title}</h1>
            {description && <p className="mt-1 text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
