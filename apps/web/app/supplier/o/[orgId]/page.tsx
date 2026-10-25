import { Boxes, PackageCheck, ShoppingCart, Truck } from "lucide-react";
import Link from "next/link";
import { listPurchaseOrders } from "@bahayplus/modules/suppliers";
import { listInventory, stockState } from "@bahayplus/modules/inventory";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { supplierContext } from "@/components/organizations/supplier-guard";
import { OrderList } from "@/components/supply/order-display";

export const metadata = { title: "Supplier dashboard" };

export default async function SupplierDashboardPage({ params }: PageProps<"/supplier/o/[orgId]">) {
  const { orgId } = await params;
  const { access, ctx, base, can } = await supplierContext(orgId);
  const [orders, inventory] = await Promise.all([
    can("orders.view") ? listPurchaseOrders(ctx, { supplierOrgId: orgId }, { limit: 50 }) : null,
    can("catalog.manage") || can("orders.view") ? listInventory(ctx, orgId) : null,
  ]);
  const o = orders?.ok ? orders.value : [];
  const low = (inventory?.ok ? inventory.value : []).filter(
    (r) => r.isActive && stockState(r.onHand, r.reserved, r.reorderLevel).low,
  );
  return (
    <>
      <PageHeader title={access.organizationName} description="Orders, stock and deliveries at a glance." />
      <section aria-label="Order summary" className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="New orders"
          value={o.filter((x) => x.status === "submitted").length}
          icon={ShoppingCart}
          href={`${base}/purchase-orders`}
          tone="terracotta"
        />
        <StatCard
          label="To ship"
          value={o.filter((x) => x.status === "accepted").length}
          icon={PackageCheck}
          href={`${base}/purchase-orders`}
        />
        <StatCard
          label="Out for delivery"
          value={o.filter((x) => x.status === "shipped").length}
          icon={Truck}
          href={`${base}/deliveries`}
        />
        <StatCard label="Low stock items" value={low.length} icon={Boxes} href={`${base}/inventory`} />
      </section>
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Recent orders"
          id="recent"
          className="xl:col-span-2"
          action={{ href: `${base}/purchase-orders`, label: "All orders" }}
        >
          {o.length ? (
            <OrderList orders={o.slice(0, 8)} hrefBase={`${base}/purchase-orders`} counterparty="buyer" />
          ) : (
            <EmptyState
              size="compact"
              icon={ShoppingCart}
              title="No orders yet"
              description="Publish your profile so service providers can order from you."
            />
          )}
        </SectionCard>
        <SectionCard title="Low stock" id="low">
          {low.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {low.map((r) => (
                <li key={r.productId} className="flex justify-between gap-2">
                  <Link href={`${base}/products/${r.productId}`} className="truncate hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-muted-foreground tabular-nums">
                    {stockState(r.onHand, r.reserved, r.reorderLevel).available} {r.unit}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">All products are above their reorder level.</p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
