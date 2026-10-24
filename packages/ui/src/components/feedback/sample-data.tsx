import { FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@bahayplus/ui/lib/utils";

/** Marks content rendered from `src/preview` sample data. Required wherever sample data is shown. */
export function SampleDataBadge({ className }: { className?: string }) {
  return (
    <span
      data-sample-data="true"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-dashed border-terracotta bg-warning-soft px-2 py-0.5 text-[11px] font-semibold tracking-wide text-terracotta-strong uppercase",
        className,
      )}
    >
      <FlaskConical aria-hidden="true" className="size-3" />
      Sample data
    </span>
  );
}

export function SampleDataNotice({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div
      role="note"
      data-sample-data="true"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-dashed border-terracotta bg-warning-soft p-3 text-sm text-terracotta-strong",
        className,
      )}
    >
      <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>
        <strong className="font-semibold">Design preview — sample data only.</strong>{" "}
        {children ?? "Nothing on this page comes from a real household, provider or transaction."}
      </p>
    </div>
  );
}
