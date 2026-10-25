import { notFound } from "next/navigation";
import { getProduct, listInventory, listStockMovements, stockState } from "@bahayplus/modules/suppliers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { supplierContext } from "@/components/organizations/supplier-guard";
import { ProductForm, StockForm } from "@/components/supply/supplier-forms";

export const metadata = { title: "Product" };

const REASON = { receipt: "Received", adjustment: "Adjustment", fulfillment: "Shipped", return: "Return" } as Record<
  string,
  string
>;

export default async function ProductPage({ params }: PageProps<"/supplier/o/[orgId]/products/[productId]">) {
  const { orgId, productId } = await params;
  const { ctx, base, can } = await supplierContext(orgId);
  const product = await getProduct(ctx, productId);
  if (!product.ok || product.value.organizationId !== orgId) notFound();
  const [inventory, movements] = await Promise.all([
    listInventory(ctx, orgId),
    listStockMovements(ctx, orgId, productId),
  ]);
  const row = inventory.ok ? inventory.value.find((r) => r.productId === productId) : undefined;
  const s = row ? stockState(row.onHand, row.reserved, row.reorderLevel) : null;
  return (
    <>
      <PageHeader
        title={product.value.name}
        eyebrow={product.value.sku}
        breadcrumbs={[
          { label: "Dashboard", href: base },
          { label: "Products", href: `${base}/products` },
          { label: product.value.name },
        ]}
      />
      {row && s && (
        <section aria-label="Stock" className="mb-4 grid grid-cols-3 gap-3">
          <StatCard label="On hand" value={`${row.onHand} ${row.unit}`} />
          <StatCard label="Reserved" value={row.reserved} />
          <StatCard label="Available" value={s.available} tone={s.low ? "terracotta" : "default"} />
        </section>
      )}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          {can("catalog.manage") && (
            <SectionCard title="Details" id="details">
              <ProductForm organizationId={orgId} product={product.value} hrefBase={`${base}/products`} />
            </SectionCard>
          )}
          <SectionCard title="Stock history" id="history">
            {movements.ok && movements.value.length ? (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {movements.value.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2">
                    <span
                      className={`w-20 text-right font-semibold tabular-nums ${m.quantity < 0 ? "text-destructive" : "text-success"}`}
                    >
                      {m.quantity > 0 ? "+" : ""}
                      {m.quantity}
                    </span>
                    <span className="flex-1">
                      {REASON[m.reason] ?? m.reason}
                      {m.note ? ` · ${m.note}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatManilaDateTime(m.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No stock movements yet.</p>
            )}
          </SectionCard>
        </div>
        {can("catalog.manage") && inventory.ok && (
          <SectionCard title="Record stock" id="stock">
            <StockForm inventory={inventory.value} defaultProductId={productId} />
          </SectionCard>
        )}
      </div>
    </>
  );
}
