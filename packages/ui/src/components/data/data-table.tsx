import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@bahayplus/ui/lib/utils";

export type SortDirection = "asc" | "desc";

export type DataTableColumn<Row> = {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  /** Hide below the `md` breakpoint to keep tables readable on phones. */
  hideOnMobile?: boolean;
  className?: string;
};

type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  /** Accessible table name; visually hidden unless `showCaption`. */
  caption: string;
  showCaption?: boolean;
  /** Rendered instead of the table when `rows` is empty. */
  empty?: ReactNode;
  /** Server-driven sorting: current sort and an href builder (keeps sorting working without JS). */
  sort?: { key: string; direction: SortDirection };
  sortHref?: (key: string, direction: SortDirection) => string;
  /** Optional card renderer used below `md` instead of the table. */
  mobileCard?: (row: Row) => ReactNode;
  footer?: ReactNode;
  className?: string;
};

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

/**
 * Presentational, server-renderable table. Data fetching, pagination and sorting live in the page
 * (usually via search params), never inside the component.
 */
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  caption,
  showCaption = false,
  empty,
  sort,
  sortHref,
  mobileCard,
  footer,
  className,
}: DataTableProps<Row>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {mobileCard && (
        <ul className="flex flex-col gap-2 md:hidden" aria-label={caption}>
          {rows.map((row) => (
            <li key={getRowKey(row)}>{mobileCard(row)}</li>
          ))}
        </ul>
      )}
      <div
        role="region"
        aria-label={caption}
        tabIndex={0}
        className={cn(
          "overflow-x-auto rounded-2xl border border-border bg-surface shadow-card focus-visible:outline-ring",
          mobileCard && "hidden md:block",
        )}
      >
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <caption className={cn(showCaption ? "p-4 text-left font-heading font-semibold" : "sr-only")}>
            {caption}
          </caption>
          <thead className="bg-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              {columns.map((col) => {
                const active = sort?.key === col.key;
                const ariaSort = active ? (sort!.direction === "asc" ? "ascending" : "descending") : undefined;
                const nextDirection: SortDirection = active && sort!.direction === "asc" ? "desc" : "asc";
                const SortIcon = !active ? ArrowUpDown : sort!.direction === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={col.sortable ? (ariaSort ?? "none") : undefined}
                    className={cn(
                      "px-4 py-3 font-semibold",
                      ALIGN[col.align ?? "left"],
                      col.hideOnMobile && "hidden md:table-cell",
                      col.className,
                    )}
                  >
                    {col.sortable && sortHref ? (
                      <Link
                        href={sortHref(col.key, nextDirection)}
                        className="inline-flex items-center gap-1 rounded-sm hover:text-foreground"
                        scroll={false}
                      >
                        {col.header}
                        <SortIcon aria-hidden="true" className="size-3.5" />
                      </Link>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                  No records to show.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={getRowKey(row)} className="border-t border-border transition-colors hover:bg-muted/40">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 align-middle",
                        ALIGN[col.align ?? "left"],
                        col.hideOnMobile && "hidden md:table-cell",
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
