"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { ProductView } from "@bahayplus/modules/suppliers";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { Textarea } from "@bahayplus/ui/components/ui/textarea";
import { formatPeso } from "@bahayplus/types/money";
import { createPurchaseOrderAction } from "@/lib/actions/operations";

/** Buyer-side order form: quantities per product, delivery details. Prices are re-read on the server. */
export function PurchaseOrderForm({
  buyerOrgId,
  supplierOrgId,
  products,
  minOrderCentavos,
  hrefBase,
}: {
  buyerOrgId: string;
  supplierOrgId: string;
  products: ProductView[];
  minOrderCentavos: number;
  hrefBase: string;
}) {
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const [qty, setQty] = useState<Record<string, string>>({});
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const lines = useMemo(
    () =>
      products
        .map((p) => ({ p, q: Number((qty[p.id] ?? "").replaceAll(",", "")) }))
        .filter(({ q }) => Number.isFinite(q) && q > 0),
    [products, qty],
  );
  const total = lines.reduce((s, { p, q }) => s + Math.round(q * p.unitPriceCentavos), 0);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await createPurchaseOrderAction({
            buyerOrgId,
            supplierOrgId,
            lines: lines.map(({ p, q }) => ({ productId: p.id, quantity: q })),
            deliveryAddress: address,
            deliveryContact: contact,
            requestedDeliveryOn: date,
            buyerNotes: notes,
            idempotencyKey: key,
          });
          if (!r.ok) return setError(r.error.message);
          router.push(`${hrefBase}/${r.data.purchaseOrderId}`);
        });
      }}
    >
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="overflow-x-auto" tabIndex={0} role="group" aria-label="Scrollable table">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">Products</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase">
              <th scope="col" className="pb-2 font-semibold">
                Product
              </th>
              <th scope="col" className="pb-2 text-right font-semibold">
                Price
              </th>
              <th scope="col" className="w-28 pb-2 text-right font-semibold">
                Quantity
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="py-2">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{[p.sku, p.category].filter(Boolean).join(" · ")}</p>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatPeso(p.unitPriceCentavos)} / {p.unit}
                </td>
                <td className="py-2 pl-2">
                  <Input
                    aria-label={`Quantity of ${p.name}`}
                    inputMode="decimal"
                    value={qty[p.id] ?? ""}
                    onChange={(e) => setQty({ ...qty, [p.id]: e.target.value })}
                    className="text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2} className="pt-2 text-right">
                Estimated total
              </th>
              <td className="pt-2 text-right font-semibold tabular-nums">{formatPeso(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {minOrderCentavos > 0 && (
        <p className="text-xs text-muted-foreground">Minimum order: {formatPeso(minOrderCentavos)}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          Delivery address
          <Textarea required rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Contact person & number
          <Input value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Preferred delivery date
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          Notes for the supplier
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Payment is arranged directly with the supplier. Prices are confirmed when the order is placed.
      </p>
      <Button type="submit" disabled={pending || lines.length === 0} className="w-fit">
        Place order
      </Button>
    </form>
  );
}
