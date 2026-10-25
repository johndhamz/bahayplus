import Link from "next/link";
import { stockState, type InventoryRow } from "@bahayplus/modules/suppliers";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";

const fmt = (n: number) => new Intl.NumberFormat("en-PH", { maximumFractionDigits: 3 }).format(n);

export function InventoryTable({ rows, productHref }: { rows: InventoryRow[]; productHref: (id: string) => string }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="group" aria-label="Scrollable table">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">Stock levels</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground uppercase">
            <th scope="col" className="pb-2 font-semibold">
              Product
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              On hand
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              Reserved
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              Available
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              <span className="sr-only">Status</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const s = stockState(r.onHand, r.reserved, r.reorderLevel);
            return (
              <tr key={r.productId}>
                <td className="py-2">
                  <Link href={productHref(r.productId)} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <span className="ml-1 text-xs text-muted-foreground">{r.sku}</span>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {fmt(r.onHand)} {r.unit}
                </td>
                <td className="py-2 text-right tabular-nums">{fmt(r.reserved)}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{fmt(s.available)}</td>
                <td className="py-2 text-right">
                  {s.out ? (
                    <StatusBadge status="out" tone="danger" label="Out of stock" />
                  ) : s.low ? (
                    <StatusBadge status="low" tone="warning" label="Low" />
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
